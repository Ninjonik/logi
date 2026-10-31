import { squadPresetRepository } from "../src/infrastructure/convex/preset-repositories"
import { saveSquadPreset } from "../src/application/presets/save-preset"
import { squadPresetSchema } from "../src/lib/validation/squad-preset"
import { systemClock } from "../src/domain/shared/clock"
import { v } from "convex/values"

import { getGuildById, getGuildDiscordId } from "./identity"
import { internalAuthSecret } from "./discord_shared"
import { mutation } from "./_generated/server"

function assertInternalSecret(secret: string) {
    if (secret !== internalAuthSecret()) {
        throw new Error("Unauthorized.")
    }
}

const squadRole = v.object({
    name: v.string(),
    color: v.string(),
    icon: v.string(),
    count: v.number(),
    note: v.optional(v.string()),
})

const squadPresetSquad = v.object({
    name: v.string(),
    group: v.string(),
    order: v.number(),
    color: v.string(),
    icon: v.string(),
    roles: v.array(squadRole),
})

export const upsert = mutation({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        presetId: v.optional(v.id("squadPresets")),
        gameId: v.optional(v.string()),
        name: v.string(),
        squads: v.array(squadPresetSquad),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const guild = await getGuildById(ctx, args.serverId)
        if (!guild) {
            throw new Error("Server not found.")
        }
        const fields = squadPresetSchema.omit({ gameId: true }).parse(args)
        const saved = await saveSquadPreset(
            squadPresetRepository(ctx),
            systemClock,
            {
                ...fields,
                guildId: getGuildDiscordId(guild),
                presetId: args.presetId,
                gameId: args.gameId,
            }
        )
        return saved.id
    },
})

/**
 * Deletes a squad preset of this clan. Rosters copied their squads when they
 * were created, so existing rosters keep their structure.
 */
export const remove = mutation({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        presetId: v.id("squadPresets"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)

        const guild = await getGuildById(ctx, args.serverId)
        if (!guild) {
            throw new Error("Server not found.")
        }
        const existing = await ctx.db.get(args.presetId)
        if (!existing || existing.guildId !== getGuildDiscordId(guild)) {
            return { ok: false as const, error: "not_found" as const }
        }

        await ctx.db.delete(args.presetId)
        return { ok: true as const }
    },
})
