import {
    seedPlanCapacityIssues,
    type SeedPlanIssue,
} from "@/domain/discord-seed/plan"
import { parseSeedPlanSettings } from "@/domain/discord-seed/plan.schema"

import type { SeedPorts, SeedServerRef, StoredSeedPlan } from "./ports"

export type SaveSeedPlanResult =
    | { kind: "saved"; plan: StoredSeedPlan }
    | { kind: "invalid"; issues: SeedPlanIssue[] }
    /** Someone saved in between; the editor reloads `revision`. */
    | { kind: "conflict"; revision: number | null }
    | { kind: "not_found" }

/**
 * Saves the seed plan and the control channel of one server (P3-25 "Uloží plán
 * Vlci #1 i kanál pro ovládání."). Settings are validated here; the caller has
 * verified the admin and the Discord channels. A running seed keeps its own
 * channel, threshold and deadline.
 */
export async function saveSeedPlan(
    ports: Pick<SeedPorts, "store" | "players" | "messages">,
    input: {
        server: SeedServerRef
        settings: unknown
        expectedRevision: number | null
        updatedBy: string
    }
): Promise<SaveSeedPlanResult> {
    const parsed = parseSeedPlanSettings(input.settings)
    if (!parsed.ok) return { kind: "invalid", issues: parsed.issues }
    const reading = await ports.players.read(input.server)
    if (!reading) return { kind: "not_found" }
    const capacity = seedPlanCapacityIssues(parsed.plan, reading.capacity)
    if (capacity.length) return { kind: "invalid", issues: capacity }
    const current = await ports.store.plan(input.server)
    const revision = current?.revision ?? null
    if (revision !== input.expectedRevision)
        return { kind: "conflict", revision }
    const plan = await ports.store.savePlanSettings({
        server: input.server,
        settings: parsed.plan,
        revision: (revision ?? 0) + 1,
        updatedBy: input.updatedBy,
    })
    await ports.messages.controlChanged(input.server)
    await ports.messages.introChanged(input.server.guildId)
    return { kind: "saved", plan }
}
