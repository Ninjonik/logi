import {
    mergeSeedPlanPatch,
    seedSettingsApiError,
    type SeedSettingsApiError,
    type SeedSettingsApiView,
    type SeedSettingsPatch,
} from "../src/domain/api/seed-settings-slice"
import {
    defaultSeedPlanSettings,
    parseSeedPlanSettings,
    seedPlanCapacityIssues,
    type SeedPlanSettings,
} from "../src/domain/discord-seed/plan"
import { seedPorts, seedReadPorts, seedServers } from "./discordSeedStore"
import { saveSeedPlan } from "../src/application/discord-seed/save-plan"
import type { MutationCtx, QueryCtx } from "./_generated/server"

/**
 * The `/api/v1` `seed` settings slice over the seed plans: read every game
 * server's plan, and validate a change of several plans before any of them
 * is written. The same use-case saves as the dashboard ("Uložit").
 */

export async function readSeedSettingsApi(
    ctx: Pick<QueryCtx, "db">,
    guildId: string
): Promise<SeedSettingsApiView> {
    const { store } = seedReadPorts(ctx)
    const servers = await seedServers(ctx, guildId)
    return {
        servers: await Promise.all(
            servers.map(async (server) => {
                const plan = await store.plan({
                    guildId,
                    connectionId: server.connectionId,
                })
                return {
                    connectionId: server.connectionId,
                    gameId: server.gameId,
                    name: server.name,
                    configured: Boolean(plan),
                    revision: plan?.revision ?? null,
                    settings: plan?.settings ?? defaultSeedPlanSettings(),
                }
            })
        ),
    }
}

export async function prepareSeedSettingsChange(
    ctx: MutationCtx,
    guildId: string,
    patch: SeedSettingsPatch
): Promise<
    | { ok: true; commit(updatedBy: string): Promise<void> }
    | { ok: false; error: SeedSettingsApiError }
> {
    const ports = seedPorts(ctx)
    const known = new Set(
        (await seedServers(ctx, guildId)).map((server) => server.connectionId)
    )
    const changes: Array<{
        connectionId: string
        settings: SeedPlanSettings
        revision: number | null
    }> = []
    for (const [index, entry] of patch.servers.entries()) {
        const server = { guildId, connectionId: entry.connectionId }
        const reading = known.has(entry.connectionId)
            ? await ports.players.read(server)
            : null
        if (!reading)
            return {
                ok: false,
                error: seedSettingsApiError({ kind: "unknown_server", index }),
            }
        const current = await ports.store.plan(server)
        const revision = current?.revision ?? null
        if (
            entry.expectedRevision !== undefined &&
            entry.expectedRevision !== revision
        )
            return {
                ok: false,
                error: seedSettingsApiError({ kind: "conflict", index }),
            }
        const parsed = parseSeedPlanSettings(
            mergeSeedPlanPatch(current?.settings ?? null, entry.settings)
        )
        const issues = parsed.ok
            ? seedPlanCapacityIssues(parsed.plan, reading.capacity)
            : parsed.issues
        if (!parsed.ok || issues.length)
            return {
                ok: false,
                error: seedSettingsApiError({ kind: "invalid", index, issues }),
            }
        changes.push({
            connectionId: entry.connectionId,
            settings: parsed.plan,
            revision,
        })
    }
    return {
        ok: true,
        commit: async (updatedBy) => {
            for (const change of changes) {
                const saved = await saveSeedPlan(ports, {
                    server: { guildId, connectionId: change.connectionId },
                    settings: change.settings,
                    expectedRevision: change.revision,
                    updatedBy,
                })
                // Checked above in the same transaction.
                if (saved.kind !== "saved")
                    throw new Error("The seed plan could not be saved.")
            }
        },
    }
}
