import {
    startSeedRun,
    type SeedActionSource,
    type SeedActor,
    type SeedTrigger,
} from "@/domain/discord-seed/run"
import {
    decideManualSeedStart,
    type SeedManualRefusal,
} from "@/domain/discord-seed/triggers"
import type { SeedPlanState } from "@/domain/discord-seed/plan"
import { decideSeedPing } from "@/domain/discord-seed/limits"

import {
    runObservation,
    triggerReading,
    type SeedPorts,
    type SeedServerReading,
    type SeedServerRef,
    type StoredSeedPlan,
    type StoredSeedRun,
} from "./ports"

/**
 * Starts a run for a plan whose trigger already passed every rule: decides the
 * ping, records the run and asks for the call and the control message. The
 * returned plan state is saved by the caller together with its other changes.
 */
export async function beginSeed(
    ports: SeedPorts,
    input: {
        plan: StoredSeedPlan
        state: SeedPlanState
        reading: SeedServerReading
        trigger: SeedTrigger
        now: number
        requestKey: string | null
    }
): Promise<{ run: StoredSeedRun; state: SeedPlanState }> {
    const { plan, now } = input
    const channelId = plan.settings.seedChannelId
    if (!channelId) throw new Error("A seed needs a seed channel.")
    const roleId = plan.settings.seedRoleId
    const ping = decideSeedPing({
        roleId,
        lastRolePingAt: roleId
            ? await ports.store.lastRolePingAt(plan.guildId, roleId)
            : null,
        pingWindowMinutes: plan.settings.pingWindowMinutes,
        now,
    })
    const created = {
        ...startSeedRun({
            trigger: input.trigger,
            now,
            plan: plan.settings,
            ping,
            observation: runObservation(input.reading),
            roster: await ports.players.roster(plan).catch(() => null),
        }),
        guildId: plan.guildId,
        connectionId: plan.connectionId,
        planId: plan.id,
        channelId,
        requestKey: input.requestKey,
        serverName: input.reading.name,
    }
    const run: StoredSeedRun = {
        ...created,
        id: await ports.store.insertRun(created),
    }
    await ports.messages.callChanged(run)
    await ports.messages.controlChanged(plan)
    return {
        run,
        state: {
            ...input.state,
            activeRunId: run.id,
            lastStartedAt: now,
            lastPingAt: ping.kind === "role" ? now : input.state.lastPingAt,
            lastAutoStartAt:
                input.trigger.kind === "auto"
                    ? now
                    : input.state.lastAutoStartAt,
        },
    }
}

export type StartSeedResult =
    | { kind: "started"; run: StoredSeedRun }
    /** The same request was already handled; nothing new was started. */
    | { kind: "duplicate"; run: StoredSeedRun }
    | { kind: "refused"; refusal: SeedManualRefusal; run?: StoredSeedRun }
    | { kind: "not_found" }

/**
 * "Seed teď" on the web and "Spustit seed" in Discord (P3-05, P5-26). Callers
 * have already established that the actor is a Logi admin of the clan.
 */
export async function startSeedManually(
    ports: SeedPorts,
    input: {
        server: SeedServerRef
        actor: SeedActor
        via: SeedActionSource
        /** The control message's channel when started from Discord. */
        channelId: string | null
        requestKey: string
    }
): Promise<StartSeedResult> {
    const plan = await ports.store.plan(input.server)
    if (!plan) return { kind: "refused", refusal: { kind: "not_configured" } }
    const duplicate = await ports.store.runByRequestKey(
        input.server,
        input.requestKey
    )
    if (duplicate) return { kind: "duplicate", run: duplicate }
    const reading = await ports.players.read(input.server)
    if (!reading) return { kind: "not_found" }
    const now = ports.clock.now().getTime()
    const decision = decideManualSeedStart({
        plan: plan.settings,
        state: plan.state,
        reading: triggerReading(reading),
        now,
    })
    if (!decision.ok) {
        const active =
            decision.refusal.kind === "running" && plan.state.activeRunId
                ? await ports.store.run(plan.state.activeRunId)
                : null
        return active
            ? { kind: "refused", refusal: decision.refusal, run: active }
            : { kind: "refused", refusal: decision.refusal }
    }
    const started = await beginSeed(ports, {
        plan,
        state: plan.state,
        reading,
        trigger: {
            kind: "manual",
            actor: input.actor,
            via: input.via,
            channelId: input.via === "discord" ? input.channelId : null,
        },
        now,
        requestKey: input.requestKey,
    })
    await ports.store.savePlanState(plan.id, started.state)
    return { kind: "started", run: started.run }
}
