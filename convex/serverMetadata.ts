import { normalizeDoc } from "../src/infrastructure/convex/server-read-model"
import { assertInternalSecret } from "./discord_shared"
import { query } from "./_generated/server"
import { v } from "convex/values"

export const getRosterById = query({
    args: {
        secret: v.string(),
        rosterId: v.id("rosters"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const roster = await ctx.db.get(args.rosterId)
        return roster ? normalizeDoc(roster) : null
    },
})

export const getSquadPresetById = query({
    args: {
        secret: v.string(),
        presetId: v.id("squadPresets"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const preset = await ctx.db.get(args.presetId)
        return preset ? normalizeDoc(preset) : null
    },
})

export const getTopicPresetById = query({
    args: {
        secret: v.string(),
        presetId: v.id("topicPresets"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const preset = await ctx.db.get(args.presetId)
        return preset ? normalizeDoc(preset) : null
    },
})
