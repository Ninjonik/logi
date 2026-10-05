import {
    applySeedRunEvent,
    isSeedRunActive,
    type SeedActionSource,
    type SeedActor,
} from "@/domain/discord-seed/run"

import type { SeedPorts, SeedServerRef, StoredSeedRun } from "./ports"

export type StopSeedResult =
    { kind: "stopped"; run: StoredSeedRun } | { kind: "not_running" }

/**
 * "Ukončit seed" (P5-28) and the dashboard's end action. The call gets the
 * "Seed ukončen" state and the panel returns to normal (P5-19). A second stop,
 * or a stop after the run ended by itself, changes nothing.
 */
export async function stopSeed(
    ports: Pick<SeedPorts, "store" | "clock" | "messages">,
    input: { server: SeedServerRef; actor: SeedActor; via: SeedActionSource }
): Promise<StopSeedResult> {
    const plan = await ports.store.plan(input.server)
    if (!plan?.state.activeRunId) return { kind: "not_running" }
    const run = await ports.store.run(plan.state.activeRunId)
    if (!run || !isSeedRunActive(run)) {
        // Repair a pointer to a run that already ended.
        await ports.store.savePlanState(plan.id, {
            ...plan.state,
            activeRunId: null,
        })
        await ports.messages.controlChanged(plan)
        return { kind: "not_running" }
    }
    const step = applySeedRunEvent(run, {
        kind: "stop",
        at: ports.clock.now().getTime(),
        actor: input.actor,
        via: input.via,
    })
    const stopped: StoredSeedRun = { ...run, ...step.run }
    await ports.store.saveRun(stopped)
    await ports.store.savePlanState(plan.id, {
        ...plan.state,
        activeRunId: null,
    })
    await ports.messages.callChanged(stopped)
    await ports.messages.controlChanged(plan)
    return { kind: "stopped", run: stopped }
}
