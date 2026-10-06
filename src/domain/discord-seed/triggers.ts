import { autoWindowAt, dueScheduleOccurrence } from "./schedule"
import type { SeedPlanSettings, SeedPlanState } from "./plan"
import { isBelowStart } from "./thresholds"
import type { SeedTrigger } from "./run"
import { seedCooldown } from "./limits"

/** A reading the triggers may act on: fresh, from the provider. */
export type SeedTriggerReading = { players: number; online: boolean | null }

export type SeedAutomaticTrigger = Extract<
    SeedTrigger,
    { kind: "schedule" | "auto" }
>

export type SeedSkipReason =
    | "running"
    | "no_data"
    | "offline"
    | "paused"
    | "cooldown"
    | "not_below_start"

/**
 * `consume` names the schedule occurrence that is decided and must not fire
 * again; null leaves it open so a later tick inside the grace window retries
 * (for example once fresh data arrives).
 */
export type SeedTriggerDecision =
    | { kind: "start"; trigger: SeedAutomaticTrigger; consume: string | null }
    | { kind: "skip"; reason: SeedSkipReason; consume: string | null }
    | { kind: "idle" }

/**
 * The automatic trigger fires once per emptying: after an automatic seed it
 * re-arms only when the server has been live again or a new window opened.
 * A server that stays empty is not called every cooldown.
 */
export function isAutoArmed(
    state: Pick<SeedPlanState, "lastAutoStartAt" | "lastLiveAt">,
    windowOpenedAt: number
) {
    return (
        state.lastAutoStartAt === null ||
        state.lastAutoStartAt < windowOpenedAt ||
        (state.lastLiveAt !== null && state.lastLiveAt > state.lastAutoStartAt)
    )
}

/**
 * Scheduled and automatic triggers (P3-10, P3-11, P3-B02). Both fire only while
 * the plan is on, the server is below the start threshold according to fresh
 * data, the server panel is not paused, no seed is running and the cooldown has
 * passed. A due schedule slot wins over the automatic trigger.
 */
export function evaluateSeedTriggers(input: {
    plan: SeedPlanSettings
    state: SeedPlanState
    reading: SeedTriggerReading | null
    paused: boolean
    now: number
    timeZone: string
}): SeedTriggerDecision {
    const { plan, state, reading, now } = input
    if (!plan.enabled) return { kind: "idle" }
    const occurrence = dueScheduleOccurrence(plan.schedule, now, input.timeZone)
    const due =
        occurrence && occurrence.key !== state.consumedOccurrence
            ? occurrence
            : null
    const skip = (
        reason: SeedSkipReason,
        consume: boolean
    ): SeedTriggerDecision =>
        due
            ? { kind: "skip", reason, consume: consume ? due.key : null }
            : { kind: "idle" }
    if (state.activeRunId) return skip("running", true)
    if (!reading) return skip("no_data", false)
    if (reading.online === false) return skip("offline", false)
    if (input.paused) return skip("paused", true)
    const cooldown = seedCooldown(
        state.lastStartedAt,
        plan.cooldownMinutes,
        now
    )
    if (due) {
        if (!cooldown.ok) return skip("cooldown", true)
        if (!isBelowStart(reading.players, plan))
            return skip("not_below_start", true)
        return {
            kind: "start",
            trigger: {
                kind: "schedule",
                days: due.days,
                time: due.time,
                occurrence: due.key,
            },
            consume: due.key,
        }
    }
    if (!plan.auto.enabled) return { kind: "idle" }
    const window = autoWindowAt(plan.auto, now, input.timeZone)
    if (
        !window.open ||
        window.openedAt === null ||
        reading.players >= plan.auto.below ||
        !isAutoArmed(state, window.openedAt)
    )
        return { kind: "idle" }
    if (!cooldown.ok) return { kind: "skip", reason: "cooldown", consume: null }
    return {
        kind: "start",
        trigger: { kind: "auto", below: plan.auto.below },
        consume: null,
    }
}

export type SeedManualRefusal =
    | { kind: "running" }
    | { kind: "not_configured" }
    | { kind: "offline" }
    | { kind: "already_live"; players: number }
    | { kind: "cooldown"; retryAt: number; remainingMs: number }

/**
 * "Seed teď" and "Spustit seed" (P3-09, P3-B02): "Jde vždy" — at any time of
 * day, at any player count below the live threshold and also while the plan
 * switch is off, which governs only the schedule and the automatic trigger.
 * Never twice at once, never without a seed channel, never on a server the
 * provider reports offline, and never inside the cooldown. Without fresh data
 * the admin decides.
 */
export function decideManualSeedStart(input: {
    plan: SeedPlanSettings
    state: SeedPlanState
    reading: SeedTriggerReading | null
    now: number
}): { ok: true } | { ok: false; refusal: SeedManualRefusal } {
    const { plan, state, reading } = input
    const refuse = (refusal: SeedManualRefusal) => ({
        ok: false as const,
        refusal,
    })
    if (state.activeRunId) return refuse({ kind: "running" })
    if (!plan.seedChannelId) return refuse({ kind: "not_configured" })
    if (reading?.online === false) return refuse({ kind: "offline" })
    if (reading && reading.players >= plan.liveFrom)
        return refuse({ kind: "already_live", players: reading.players })
    const cooldown = seedCooldown(
        state.lastStartedAt,
        plan.cooldownMinutes,
        input.now
    )
    if (!cooldown.ok)
        return refuse({
            kind: "cooldown",
            retryAt: cooldown.retryAt,
            remainingMs: cooldown.remainingMs,
        })
    return { ok: true }
}
