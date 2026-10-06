import {
    seedRunSeeders,
    type SeedActionSource,
    type SeedFailure,
    type SeedRun,
    type SeedRunStatus,
} from "./run"
import type { SeedPing } from "./limits"

/** The dashboard shows the last 30 days of seeds per server (P3-26). */
export const SEED_HISTORY_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

export type SeedOutcome = "running" | "live" | "timeout" | "admin" | "failed"

const OUTCOMES: Record<SeedRunStatus, SeedOutcome> = {
    seeding: "running",
    live: "live",
    ended_timeout: "timeout",
    ended_admin: "admin",
    failed: "failed",
}

/**
 * Who or what started a seed ("Spustil"). Manual starts keep the admin's
 * display name and where they clicked; Discord IDs stay out of the history.
 */
export type SeedHistoryTrigger =
    | {
          kind: "manual"
          actorName: string
          via: SeedActionSource
          channelId: string | null
      }
    | { kind: "schedule"; days: number[]; time: string }
    | { kind: "auto"; below: number }

/** "Označeno": the role and its member count, or why the call went out silent. */
export type SeedHistoryPing =
    | { kind: "role"; roleId: string; members: number | null }
    | { kind: "silent"; reason: "ping_window"; windowMinutes: number }
    | { kind: "silent"; reason: "no_role" }

export type SeedHistoryEntry = {
    id: string
    startedAt: string
    endedAt: string | null
    trigger: SeedHistoryTrigger
    playersAtStart: number | null
    /** The latest count of a running seed, the final count of an ended one. */
    playersAtEnd: number | null
    outcome: SeedOutcome
    durationMinutes: number
    ping: SeedHistoryPing
    seeders: number | null
    endedByName: string | null
    failure: SeedFailure | null
}

function historyPing(ping: SeedPing, members: number | null): SeedHistoryPing {
    if (ping.kind === "role")
        return { kind: "role", roleId: ping.roleId, members }
    return ping.reason === "ping_window"
        ? {
              kind: "silent",
              reason: "ping_window",
              windowMinutes: ping.windowMinutes,
          }
        : { kind: "silent", reason: "no_role" }
}

export function toSeedHistoryEntry(
    run: SeedRun & { id: string },
    now: number
): SeedHistoryEntry {
    const trigger: SeedHistoryTrigger =
        run.trigger.kind === "manual"
            ? {
                  kind: "manual",
                  actorName: run.trigger.actor.name,
                  via: run.trigger.via,
                  channelId: run.trigger.channelId,
              }
            : run.trigger.kind === "schedule"
              ? {
                    kind: "schedule",
                    days: run.trigger.days,
                    time: run.trigger.time,
                }
              : { kind: "auto", below: run.trigger.below }
    const until = run.endedAt ?? Math.max(now, run.startedAt)
    return {
        id: run.id,
        startedAt: new Date(run.startedAt).toISOString(),
        endedAt:
            run.endedAt === null ? null : new Date(run.endedAt).toISOString(),
        trigger,
        playersAtStart: run.players.start,
        playersAtEnd: run.players.end ?? run.players.latest,
        outcome: OUTCOMES[run.status],
        durationMinutes: Math.max(
            0,
            Math.round((until - run.startedAt) / MINUTE_MS)
        ),
        ping: historyPing(run.ping, run.pingedMembers),
        seeders: run.status === "seeding" ? null : seedRunSeeders(run),
        endedByName: run.endedBy?.name ?? null,
        failure: run.failure,
    }
}

export type SeedHistorySummary = {
    days: number
    /** Seeds started in the window ("5 seedů"). */
    count: number
    liveCount: number
    /** Average minutes to live over seeds that reached it ("průměrně 47 min do živé hry"). */
    averageMinutesToLive: number | null
}

export function summarizeSeedHistory(
    runs: ReadonlyArray<Pick<SeedRun, "status" | "startedAt" | "endedAt">>,
    now: number,
    days = SEED_HISTORY_DAYS
): SeedHistorySummary {
    const since = now - days * DAY_MS
    const recent = runs.filter((run) => run.startedAt >= since)
    const live = recent.filter(
        (run) => run.status === "live" && run.endedAt !== null
    )
    const total = live.reduce(
        (sum, run) => sum + (run.endedAt! - run.startedAt),
        0
    )
    return {
        days,
        count: recent.length,
        liveCount: live.length,
        averageMinutesToLive: live.length
            ? Math.round(total / live.length / MINUTE_MS)
            : null,
    }
}
