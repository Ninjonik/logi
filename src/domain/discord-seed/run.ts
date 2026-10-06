import type { SeedEndAction, SeedPlanSettings } from "./plan"
import { seedDeadline, type SeedPing } from "./limits"

/**
 * One seed run and its lifecycle (P5-B01). A server with no running seed is
 * idle. A run starts in `seeding` and ends exactly once:
 *
 *   idle → seeding → live           (the live threshold was reached)
 *                  → ended_timeout  (the maximum duration passed)
 *                  → ended_admin    (an admin ended it)
 *                  → failed         (the call could not be delivered, or the server vanished)
 *
 * Every terminal state is final; later events are ignored, so a repeated or
 * late delivery never changes history.
 */
export type SeedRunStatus =
    "seeding" | "live" | "ended_timeout" | "ended_admin" | "failed"

export const SEED_TERMINAL_STATUSES: readonly SeedRunStatus[] = [
    "live",
    "ended_timeout",
    "ended_admin",
    "failed",
]

/** A seed's call that is not in Discord this long after the start fails the run. */
export const SEED_CALL_DELIVERY_DEADLINE_MS = 10 * 60 * 1000

export type SeedActor = { id: string; name: string }
export type SeedActionSource = "web" | "discord"

export type SeedTrigger =
    | {
          kind: "manual"
          actor: SeedActor
          via: SeedActionSource
          /** The admin channel of the control message, for "tlačítko v #spravci". */
          channelId: string | null
      }
    | { kind: "schedule"; days: number[]; time: string; occurrence: string }
    | { kind: "auto"; below: number }

export type SeedFailure =
    "call_not_delivered" | "channel_unavailable" | "server_unavailable"

/** A fresh player count of the server. */
export type SeedObservation = {
    players: number
    capacity: number | null
    map: string | null
    observedAt: number
}

/**
 * The players on the server by their provider IDs, from a live read that
 * names them (HLL through CRCON). Only counted, never shown or kept.
 */
export type SeedRoster = { ids: readonly string[]; observedAt: number }

/**
 * Who joined during the seed (P5-B04): the players on the server at the
 * start and those first seen later. The IDs are dropped when the run ends;
 * only the count stays.
 */
export type SeedRunJoins = {
    present: string[]
    joined: string[]
    /** Set when the run ends; the lists are empty from then on. */
    count: number | null
}

/** A read this close to the start counts as the start's roster. */
export const SEED_ROSTER_BASELINE_MS = 2 * 60 * 1000
/** Upper bound of tracked joiners; a seed never comes near it. */
const SEED_ROSTER_LIMIT = 1000

export type SeedRunPlayers = {
    start: number | null
    latest: number | null
    peak: number | null
    end: number | null
    capacity: number | null
    map: string | null
    observedAt: number | null
}

export type SeedRun = {
    status: SeedRunStatus
    trigger: SeedTrigger
    startedAt: number
    deadlineAt: number
    endedAt: number | null
    liveFrom: number
    endAction: SeedEndAction
    ping: SeedPing
    players: SeedRunPlayers
    /** Set when the call is in Discord; the bot reports it. */
    callPostedAt: number | null
    /** Members of the Seed role when the call pinged it ("34 · @Seed"). */
    pingedMembers: number | null
    endedBy: (SeedActor & { via: SeedActionSource }) | null
    failure: SeedFailure | null
    /**
     * Distinct joiners when a live read named the players at the start;
     * null (or missing on older runs) when Logi only had player counts.
     */
    joins?: SeedRunJoins | null
}

const unique = (ids: readonly string[]) =>
    [...new Set(ids.filter((id) => id.trim()))].slice(0, SEED_ROSTER_LIMIT)

export function isSeedRunActive(run: Pick<SeedRun, "status">) {
    return run.status === "seeding"
}

export function startSeedRun(input: {
    trigger: SeedTrigger
    now: number
    plan: Pick<
        SeedPlanSettings,
        "liveFrom" | "maxDurationMinutes" | "endAction"
    >
    ping: SeedPing
    observation: SeedObservation | null
    /** The named players at the start, when the live read has them. */
    roster?: SeedRoster | null
}): SeedRun {
    const players = input.observation?.players ?? null
    const roster = input.roster
    const baseline =
        roster &&
        Math.abs(roster.observedAt - input.now) <= SEED_ROSTER_BASELINE_MS
            ? roster
            : null
    return {
        status: "seeding",
        trigger: input.trigger,
        startedAt: input.now,
        deadlineAt: seedDeadline(input.now, input.plan.maxDurationMinutes),
        endedAt: null,
        liveFrom: input.plan.liveFrom,
        endAction: input.plan.endAction,
        ping: input.ping,
        players: {
            start: players,
            latest: players,
            peak: players,
            end: null,
            capacity: input.observation?.capacity ?? null,
            map: input.observation?.map ?? null,
            observedAt: input.observation?.observedAt ?? null,
        },
        callPostedAt: null,
        pingedMembers: null,
        endedBy: null,
        failure: null,
        joins: baseline
            ? { present: unique(baseline.ids), joined: [], count: null }
            : null,
    }
}

export type SeedRunEvent =
    /** A tick: the latest fresh reading (or none) at time `at`. */
    | {
          kind: "observe"
          at: number
          observation: SeedObservation | null
          /** The named players now, when the live read has them (P5-B04). */
          roster?: SeedRoster | null
      }
    | { kind: "call_posted"; at: number; pingedMembers: number | null }
    | {
          kind: "stop"
          at: number
          actor: SeedActor
          via: SeedActionSource
      }
    | { kind: "fail"; at: number; reason: SeedFailure }

export type SeedRunStep = {
    run: SeedRun
    /** Anything stored changed (progress or status). */
    changed: boolean
    /** The run reached a terminal state with this event. */
    ended: boolean
}

const unchanged = (run: SeedRun): SeedRunStep => ({
    run,
    changed: false,
    ended: false,
})

function end(
    run: SeedRun,
    status: Exclude<SeedRunStatus, "seeding">,
    endedAt: number,
    extra: Partial<SeedRun> = {}
): SeedRunStep {
    return {
        run: {
            ...run,
            ...extra,
            status,
            endedAt,
            players: { ...run.players, end: run.players.latest },
            // Only the number of joiners is kept, never who they were.
            joins: run.joins
                ? {
                      present: [],
                      joined: [],
                      count: run.joins.count ?? run.joins.joined.length,
                  }
                : (run.joins ?? null),
        },
        changed: true,
        ended: true,
    }
}

/** Applies one event; invalid transitions (anything after the end) are ignored. */
export function applySeedRunEvent(
    run: SeedRun,
    event: SeedRunEvent
): SeedRunStep {
    if (event.kind === "call_posted") {
        if (run.callPostedAt !== null) return unchanged(run)
        return {
            run: {
                ...run,
                callPostedAt: event.at,
                pingedMembers:
                    run.ping.kind === "role" ? event.pingedMembers : null,
            },
            changed: true,
            ended: false,
        }
    }
    if (!isSeedRunActive(run)) return unchanged(run)
    if (event.kind === "stop")
        return end(run, "ended_admin", event.at, {
            endedBy: { ...event.actor, via: event.via },
        })
    if (event.kind === "fail")
        return end(run, "failed", event.at, { failure: event.reason })

    let next = run
    let changed = false
    // P5-B04: everyone named after the start who was not there at the start.
    const roster = event.roster
    if (
        roster &&
        roster.observedAt >= run.startedAt - SEED_ROSTER_BASELINE_MS
    ) {
        const joins = run.joins
        if (
            !joins &&
            roster.observedAt <= run.startedAt + SEED_ROSTER_BASELINE_MS
        ) {
            next = {
                ...next,
                joins: { present: unique(roster.ids), joined: [], count: null },
            }
            changed = true
        } else if (joins && joins.count === null) {
            const known = new Set([...joins.present, ...joins.joined])
            const fresh = unique(roster.ids).filter((id) => !known.has(id))
            if (fresh.length) {
                next = {
                    ...next,
                    joins: {
                        ...joins,
                        joined: [...joins.joined, ...fresh].slice(
                            0,
                            SEED_ROSTER_LIMIT
                        ),
                    },
                }
                changed = true
            }
        }
    }
    const seen = event.observation
    // Only readings taken after the start count for progress and the live
    // threshold; an older reading may predate the seed.
    if (
        seen &&
        seen.observedAt >= run.startedAt &&
        seen.observedAt > (run.players.observedAt ?? -Infinity)
    ) {
        next = {
            ...next,
            players: {
                ...next.players,
                latest: seen.players,
                peak: Math.max(next.players.peak ?? 0, seen.players),
                capacity: seen.capacity,
                map: seen.map,
                observedAt: seen.observedAt,
            },
        }
        changed = true
        if (seen.observedAt <= run.deadlineAt && seen.players >= run.liveFrom)
            return end(next, "live", Math.min(event.at, seen.observedAt))
    }
    if (
        next.callPostedAt === null &&
        event.at >= next.startedAt + SEED_CALL_DELIVERY_DEADLINE_MS
    )
        return end(next, "failed", event.at, {
            failure: "call_not_delivered",
        })
    if (event.at >= next.deadlineAt)
        return end(next, "ended_timeout", next.deadlineAt)
    return { run: next, changed, ended: false }
}

/**
 * Seeders are the players who joined during the seed (P5-B04): the distinct
 * players first seen after the start, when a live read named the players
 * from the start. With player counts only, the growth from the start to the
 * peak stands in.
 */
export function seedRunSeeders(
    run: Pick<SeedRun, "players" | "joins">
): number | null {
    if (run.joins) return run.joins.count ?? run.joins.joined.length
    const { start, peak } = run.players
    return start === null || peak === null ? null : Math.max(0, peak - start)
}
