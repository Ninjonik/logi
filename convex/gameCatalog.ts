import { v } from "convex/values"

import { assertSessionGateway } from "./dashboardSessionStore"
import { authorizePlatformAdmin } from "./platformAdmin"
import { assertInternalSecret } from "./discord_shared"
import { mutation, query } from "./_generated/server"
import { dashboardActor } from "./dashboardActor"

const capabilities = v.object({
    maps: v.boolean(),
    stratmaps: v.boolean(),
    serverData: v.boolean(),
    playerStats: v.boolean(),
    matchResults: v.boolean(),
    competitions: v.boolean(),
})
const eventSelection = v.object({
    primaryLabel: v.string(),
    primaryOptions: v.array(v.string()),
    targetLabel: v.optional(v.string()),
    targetOptional: v.boolean(),
})

const genericCapabilities = {
    maps: false,
    stratmaps: false,
    serverData: false,
    playerStats: false,
    matchResults: false,
    competitions: false,
}

const wowForever = {
    id: "world_of_warcraft_forever",
    name: "World of Warcraft: Forever",
    capabilities: genericCapabilities,
    eventSelection: {
        primaryLabel: "Activity",
        primaryOptions: [
            "Raid",
            "Dungeon",
            "Battleground",
            "World PvP",
            "Leveling / questing",
            "Profession / crafting",
            "Social",
            "Other",
        ],
        targetLabel: "Target",
        targetOptional: true,
    },
}

/** Platform catalogue read used by settings and superadmin management. */
export const list = query({
    args: { includeArchived: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const rows = await ctx.db.query("gameCatalog").collect()
        return rows
            .filter((row) => args.includeArchived || row.archivedAt === null)
            .sort((a, b) => a.name.localeCompare(b.name))
    },
})

/** Seeds current static games once, preserving their published stable IDs. */
export const seedBuiltIns = mutation({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const now = new Date().toISOString()
        const games = [
            {
                id: "hell_let_loose",
                name: "Hell Let Loose",
                capabilities: {
                    maps: true,
                    stratmaps: true,
                    serverData: true,
                    playerStats: true,
                    matchResults: true,
                    competitions: true,
                },
                eventSelection: {
                    primaryLabel: "Map",
                    primaryOptions: [],
                    targetOptional: true,
                },
            },
            {
                id: "hell_let_loose_vietnam",
                name: "Hell Let Loose: Vietnam",
                capabilities: { ...genericCapabilities, maps: true },
                eventSelection: {
                    primaryLabel: "Map",
                    primaryOptions: [],
                    targetOptional: true,
                },
            },
            {
                id: "wardogs",
                name: "Wardogs",
                capabilities: {
                    maps: true,
                    stratmaps: true,
                    serverData: true,
                    playerStats: true,
                    matchResults: true,
                    competitions: true,
                },
                eventSelection: {
                    primaryLabel: "Map",
                    primaryOptions: [],
                    targetOptional: true,
                },
            },
            wowForever,
        ]
        for (const game of games) {
            const existing = await ctx.db
                .query("gameCatalog")
                .withIndex("id", (q) => q.eq("id", game.id))
                .unique()
            if (!existing)
                await ctx.db.insert("gameCatalog", {
                    ...game,
                    iconAssetId: null,
                    archivedAt: null,
                    createdAt: now,
                    updatedAt: now,
                    createdBy: "migration",
                    updatedBy: "migration",
                })
        }
    },
})

export const upsert = mutation({
    args: {
        secret: v.string(),
        actor: dashboardActor,
        id: v.string(),
        name: v.string(),
        iconAssetId: v.union(v.id("imageAssets"), v.null()),
        capabilities,
        eventSelection,
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const admin = await authorizePlatformAdmin(ctx, args)
        // Game IDs are opaque platform-owned keys.  Superadmins choose them;
        // the unique catalogue index is the only constraint Logi imposes.
        const id = args.id.trim()
        if (!id) throw new Error("Game ID is required.")
        const name = args.name.trim()
        if (!name) throw new Error("Game name is required.")
        const existing = await ctx.db
            .query("gameCatalog")
            .withIndex("id", (q) => q.eq("id", id))
            .unique()
        const now = new Date().toISOString()
        const value = {
            name,
            iconAssetId: args.iconAssetId,
            capabilities: args.capabilities,
            eventSelection: args.eventSelection,
            archivedAt: null,
            updatedAt: now,
            updatedBy: admin.session.subject,
        }
        if (existing) await ctx.db.patch(existing._id, value)
        else
            await ctx.db.insert("gameCatalog", {
                id,
                ...value,
                createdAt: now,
                createdBy: admin.session.subject,
            })
        return { ok: true }
    },
})
