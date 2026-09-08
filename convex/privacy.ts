import { mutation } from "./_generated/server"
import { v } from "convex/values"

const internalSecret = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"

export const request = mutation({
    args: {
        secret: v.string(),
        userId: v.string(),
        discordId: v.string(),
        userName: v.string(),
        type: v.union(v.literal("export"), v.literal("erasure")),
    },
    handler: async (ctx, args) => {
        if (args.secret !== internalSecret) throw new Error("Unauthorized.")
        const existing = await ctx.db
            .query("privacyRequests")
            .withIndex("userId", (q) => q.eq("userId", args.userId))
            .collect()
        const openRequest = existing.find(
            (request) => request.type === args.type && request.status === "requested"
        )
        if (openRequest) return { requestId: openRequest._id, duplicate: true }
        const requestId = await ctx.db.insert("privacyRequests", {
            userId: args.userId,
            discordId: args.discordId,
            userName: args.userName,
            type: args.type,
            status: "requested",
            requestedAt: new Date().toISOString(),
        })
        return { requestId, duplicate: false }
    },
})
