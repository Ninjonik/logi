/**
 * The one-time redraw of match messages posted before the redesign (board
 * L1 1.15, L1-147..152, L1-B20). After the first sync the worker asks Convex
 * which upcoming matches, and matches that ended in the last 14 days, still
 * have messages of the old bot: an announcement card of an older layout, or
 * the roster card and forum post of a match whose announcement the old bot
 * had already removed. It queues a few of them a minute for a normal event
 * sync, which redraws every message in place without a ping. The card's
 * redraw records its layout; a match without a card records the migration
 * version once its sync finished. Either way a restart never redraws a match
 * twice, and the worker stops once nothing is left.
 */

import {
    ANNOUNCEMENT_LAYOUT_VERSION,
    ANNOUNCEMENT_MIGRATIONS_PER_MINUTE,
} from "../../../src/domain/events/announcement-migration"
import { announcementReferences } from "./announcement-sync"
import { logInfo, logWarn } from "../log"
import { env } from "../environment"
import { convex } from "../convex"

/** Let the start-up sync settle first ("při první synchronizaci po aktualizaci"). */
const FIRST_RUN_DELAY_MS = 90_000
const INTERVAL_MS = 60_000
/** A card that fails this often waits for its next ordinary sync. */
const MAX_ATTEMPTS = 3

type Due = { eventId: string; guildId: string }

/** Matches queued by this worker whose sync has not finished yet. */
const queuedMigrations = new Set<string>()

/**
 * Called when an event sync finished: a match this worker queued that has
 * no announcement card is marked done in Convex, because its roster card
 * and forum post were just redrawn. A match with a card is marked by the
 * card's own redraw, which may still wait for the rate limit.
 */
export async function finishAnnouncementMigration(
    input: { eventId: string; guildId: string; hasCard: boolean },
    record: (input: {
        eventId: string
        guildId: string
        migrationVersion: string
    }) => Promise<unknown> = (args) =>
        convex.mutation(announcementReferences.record, {
            secret: env.internalSecret,
            eventId: args.eventId as never,
            guildId: args.guildId,
            migrationVersion: args.migrationVersion,
        })
) {
    if (!queuedMigrations.delete(input.eventId) || input.hasCard) return false
    try {
        await record({
            eventId: input.eventId,
            guildId: input.guildId,
            migrationVersion: ANNOUNCEMENT_LAYOUT_VERSION,
        })
        logInfo("announcement-migration", "Redrew a match without a card", {
            eventId: input.eventId,
            guildId: input.guildId,
        })
        return true
    } catch (error) {
        // The next pass queues it once more; the redraw itself is idempotent.
        logWarn("announcement-migration", "Could not record the redraw", {
            eventId: input.eventId,
            error,
        })
        return false
    }
}

export type AnnouncementMigrationDeps = {
    listDue: (now: Date) => Promise<Due[]>
    queueEventSync: (eventId: string) => void
    triggerSoon: () => void
    now?: () => Date
}

/**
 * One pass: queues at most a minute's worth of due cards, skipping any that
 * already failed too often. Returns how many are still due (0 = done).
 */
export async function runAnnouncementMigrationPass(
    deps: AnnouncementMigrationDeps,
    attempts: Map<string, number>
) {
    const due = await deps.listDue(deps.now?.() ?? new Date())
    const open = due.filter(
        (item) => (attempts.get(item.eventId) ?? 0) < MAX_ATTEMPTS
    )
    const batch = open.slice(0, ANNOUNCEMENT_MIGRATIONS_PER_MINUTE)
    for (const item of batch) {
        attempts.set(item.eventId, (attempts.get(item.eventId) ?? 0) + 1)
        queuedMigrations.add(item.eventId)
        deps.queueEventSync(item.eventId)
    }
    if (batch.length) deps.triggerSoon()
    return open.length
}

export function startAnnouncementMigration(input: {
    queueEventSync: (eventId: string) => void
    triggerSoon: () => void
}) {
    const attempts = new Map<string, number>()
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    const deps: AnnouncementMigrationDeps = {
        ...input,
        listDue: async (now) =>
            (await convex.query(announcementReferences.listMigrationDue, {
                secret: env.internalSecret,
                version: ANNOUNCEMENT_LAYOUT_VERSION,
                now: now.toISOString(),
                limit: 50,
            })) as Due[],
    }
    const tick = async () => {
        if (stopped) return
        try {
            const remaining = await runAnnouncementMigrationPass(deps, attempts)
            if (!remaining) {
                logInfo("announcement-migration", "All announcements redrawn")
                return
            }
            logInfo("announcement-migration", "Redrawing old announcements", {
                remaining,
            })
        } catch (error) {
            // An older backend without the query: try again later.
            logWarn("announcement-migration", "Migration pass failed", {
                error,
            })
        }
        timer = setTimeout(() => void tick(), INTERVAL_MS)
        timer.unref?.()
    }
    timer = setTimeout(() => void tick(), FIRST_RUN_DELAY_MS)
    timer.unref?.()
    return () => {
        stopped = true
        if (timer) clearTimeout(timer)
    }
}
