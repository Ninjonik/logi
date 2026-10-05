import {
    applySeedRunEvent,
    isSeedRunActive,
    type SeedRunStatus,
} from "@/domain/discord-seed/run"
import {
    evaluateSeedTriggers,
    type SeedSkipReason,
} from "@/domain/discord-seed/triggers"
import { nextSeedServerPhase } from "@/domain/discord-seed/thresholds"
import type { SeedPlanState } from "@/domain/discord-seed/plan"

import {
    runObservation,
    triggerReading,
    type SeedPorts,
    type SeedServerReading,
    type StoredSeedPlan,
    type StoredSeedRun,
} from "./ports"
import { beginSeed } from "./start-seed"

function stateChanged(before: SeedPlanState, after: SeedPlanState) {
    return (Object.keys(after) as Array<keyof SeedPlanState>).some(
        (key) => before[key] !== after[key]
    )
}

/** A live server re-marks `lastLiveAt` at most this often (the automatic trigger's re-arm). */
const LIVE_MARK_INTERVAL_MS = 5 * 60 * 1000

export type SeedPlanTick =
    | { kind: "started"; runId: string; trigger: "schedule" | "auto" }
    | { kind: "ended"; runId: string; status: SeedRunStatus }
    | { kind: "progressed"; runId: string }
    | { kind: "skipped"; reason: SeedSkipReason }
    | { kind: "idle" }

/**
 * Marks a running seed live, expires it, or fails it, from the latest reading
 * (P3-B04, P3-B05, P5-B01). A server that disappeared fails the run.
 */
export async function advanceActiveSeed(
    ports: Pick<SeedPorts, "store" | "messages">,
    input: {
        state: SeedPlanState
        reading: SeedServerReading | null
        now: number
    }
): Promise<{
    state: SeedPlanState
    run: StoredSeedRun | null
    ended: boolean
    changed: boolean
}> {
    const { state } = input
    const run = state.activeRunId
        ? await ports.store.run(state.activeRunId)
        : null
    if (!run || !isSeedRunActive(run))
        return {
            state: { ...state, activeRunId: null },
            run,
            ended: Boolean(state.activeRunId),
            changed: false,
        }
    const step = applySeedRunEvent(
        run,
        input.reading
            ? {
                  kind: "observe",
                  at: input.now,
                  observation: runObservation(input.reading),
              }
            : { kind: "fail", at: input.now, reason: "server_unavailable" }
    )
    const next: StoredSeedRun = { ...run, ...step.run }
    if (step.changed) {
        await ports.store.saveRun(next)
        await ports.messages.callChanged(next)
    }
    return {
        state: step.ended ? { ...state, activeRunId: null } : state,
        run: next,
        ended: step.ended,
        changed: step.changed,
    }
}

/**
 * The once-a-minute tick for one plan: hysteresis memory, the running seed,
 * then the scheduled and automatic triggers. Deterministic for a given store,
 * reading and time, so a duplicate tick finds nothing left to do. Convex runs
 * each plan in its own transaction, so one broken plan never blocks another.
 */
export async function evaluateSeedPlan(
    ports: SeedPorts,
    plan: StoredSeedPlan,
    now: number
): Promise<SeedPlanTick> {
    const reading = await ports.players.read(plan)
    const fresh = triggerReading(reading)
    let state: SeedPlanState = { ...plan.state }
    let controlChanged = false
    let result: SeedPlanTick = { kind: "idle" }
    if (fresh && fresh.online !== false) {
        const phase = nextSeedServerPhase(
            state.phase,
            fresh.players,
            plan.settings
        )
        if (phase !== state.phase) {
            state.phase = phase
            controlChanged = true
        }
        if (
            fresh.players >= plan.settings.liveFrom &&
            (state.lastLiveAt === null ||
                now - state.lastLiveAt >= LIVE_MARK_INTERVAL_MS ||
                (state.lastAutoStartAt ?? -Infinity) >= state.lastLiveAt)
        )
            state.lastLiveAt = now
    }
    if (state.activeRunId) {
        const advanced = await advanceActiveSeed(ports, {
            state,
            reading,
            now,
        })
        state = advanced.state
        if (advanced.ended) {
            controlChanged = true
            if (advanced.run)
                result = {
                    kind: "ended",
                    runId: advanced.run.id,
                    status: advanced.run.status,
                }
        } else if (advanced.changed && advanced.run)
            result = { kind: "progressed", runId: advanced.run.id }
    }
    if (!state.activeRunId && result.kind !== "ended" && reading) {
        const decision = evaluateSeedTriggers({
            plan: plan.settings,
            state,
            reading: fresh,
            paused: await ports.store.isPaused(plan),
            now,
            timeZone: await ports.store.timeZone(plan.guildId),
        })
        if (decision.kind === "start") {
            const started = await beginSeed(ports, {
                plan,
                state: {
                    ...state,
                    consumedOccurrence:
                        decision.consume ?? state.consumedOccurrence,
                },
                reading,
                trigger: decision.trigger,
                now,
                requestKey: null,
            })
            state = started.state
            controlChanged = false // beginSeed already asked for it
            result = {
                kind: "started",
                runId: started.run.id,
                trigger: decision.trigger.kind,
            }
        } else if (decision.kind === "skip") {
            if (decision.consume) state.consumedOccurrence = decision.consume
            result = { kind: "skipped", reason: decision.reason }
        }
    }
    if (stateChanged(plan.state, state))
        await ports.store.savePlanState(plan.id, state)
    if (controlChanged) await ports.messages.controlChanged(plan)
    return result
}
