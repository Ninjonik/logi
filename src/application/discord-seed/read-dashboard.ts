import {
    SEED_HISTORY_DAYS,
    summarizeSeedHistory,
    toSeedHistoryEntry,
    type SeedHistoryEntry,
    type SeedHistoryPing,
    type SeedHistorySummary,
    type SeedHistoryTrigger,
} from "@/domain/discord-seed/history"
import {
    defaultSeedPlanSettings,
    type SeedPlanSettings,
} from "@/domain/discord-seed/plan"
import {
    seedServerStatus,
    type SeedServerStatus,
} from "@/domain/discord-seed/thresholds"
import { seedProgress, type SeedProgress } from "@/domain/discord-seed/progress"
import { nextScheduleOccurrence } from "@/domain/discord-seed/schedule"
import { seedCooldown } from "@/domain/discord-seed/limits"
import { isSeedRunActive } from "@/domain/discord-seed/run"
import type { Clock } from "@/application/ports/clock"

import type {
    SeedPlayerCountPort,
    SeedServerRef,
    SeedStoreReader,
} from "./ports"

const DAY_MS = 24 * 60 * 60 * 1000
/** Enough rows for 30 days of a busy server; older seeds stay stored. */
export const SEED_HISTORY_LIMIT = 200

const iso = (value: number | null) =>
    value === null ? null : new Date(value).toISOString()

export type SeedDashboardView = {
    server: SeedServerRef & {
        name: string | null
        gameId: "hell_let_loose" | "wardogs"
    }
    /** False until the first save; the settings are then the defaults. */
    configured: boolean
    revision: number | null
    settings: SeedPlanSettings
    status: {
        players: number | null
        capacity: number | null
        map: string | null
        observedAt: string | null
        fresh: boolean
        serverStatus: SeedServerStatus
        running: boolean
        nextScheduledAt: string | null
        lastStartedAt: string | null
        /** When "Seed teď" works again; null outside the cooldown. */
        cooldownUntil: string | null
    }
    activeRun: null | {
        id: string
        startedAt: string
        deadlineAt: string
        trigger: SeedHistoryTrigger
        progress: SeedProgress
        ping: SeedHistoryPing
        callPosted: boolean
    }
    history: { entries: SeedHistoryEntry[]; summary: SeedHistorySummary }
}

/** Everything the P3 page shows for one server: status row, plan and history. */
export async function readSeedDashboard(
    ports: {
        store: SeedStoreReader
        players: SeedPlayerCountPort
        clock: Clock
    },
    server: SeedServerRef
): Promise<SeedDashboardView | null> {
    const reading = await ports.players.read(server)
    if (!reading) return null
    const now = ports.clock.now().getTime()
    const [plan, timeZone, runs] = await Promise.all([
        ports.store.plan(server),
        ports.store.timeZone(server.guildId),
        ports.store.runsSince(
            server,
            now - SEED_HISTORY_DAYS * DAY_MS,
            SEED_HISTORY_LIMIT
        ),
    ])
    const settings = plan?.settings ?? defaultSeedPlanSettings()
    const active = runs.find(
        (run) => run.id === plan?.state.activeRunId && isSeedRunActive(run)
    )
    const cooldown = seedCooldown(
        plan?.state.lastStartedAt ?? null,
        settings.cooldownMinutes,
        now
    )
    const entries = runs.map((run) => toSeedHistoryEntry(run, now))
    return {
        server: { ...server, name: reading.name, gameId: reading.gameId },
        configured: Boolean(plan),
        revision: plan?.revision ?? null,
        settings,
        status: {
            players: reading.players,
            capacity: reading.capacity,
            map: reading.map,
            observedAt: iso(reading.observedAt),
            fresh: reading.fresh,
            serverStatus: seedServerStatus(
                {
                    phase: plan?.state.phase ?? null,
                    players: reading.players,
                    online: reading.online,
                    fresh: reading.fresh,
                },
                settings
            ),
            running: Boolean(active),
            nextScheduledAt: settings.enabled
                ? iso(
                      nextScheduleOccurrence(settings.schedule, now, timeZone)
                          ?.at ?? null
                  )
                : null,
            lastStartedAt: iso(plan?.state.lastStartedAt ?? null),
            cooldownUntil: cooldown.ok ? null : iso(cooldown.retryAt),
        },
        activeRun: active
            ? {
                  id: active.id,
                  startedAt: new Date(active.startedAt).toISOString(),
                  deadlineAt: new Date(active.deadlineAt).toISOString(),
                  trigger: toSeedHistoryEntry(active, now).trigger,
                  progress: seedProgress(
                      active.players.latest,
                      active.liveFrom
                  ),
                  ping: toSeedHistoryEntry(active, now).ping,
                  callPosted: active.callPostedAt !== null,
              }
            : null,
        history: {
            entries,
            summary: summarizeSeedHistory(runs, now),
        },
    }
}
