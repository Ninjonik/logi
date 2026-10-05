/**
 * The one-time redraw of match announcements posted before the redesign
 * (board L1 1.15, L1-147..152, L1-B20). After the first sync the worker asks
 * Convex which posted cards of upcoming matches, and of matches that ended in
 * the last 14 days, still have an older layout, and queues a few of them a
 * minute for a normal event sync. The sync redraws the card in place without
 * a ping and records the new layout in Convex, so a restart never redraws a
 * card twice. The worker stops once nothing is left.
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
