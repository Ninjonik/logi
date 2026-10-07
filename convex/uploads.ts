import { mutation, query } from "./_generated/server"
import { internalAuthSecret } from "./discord_shared"
import { v } from "convex/values"

function assertInternalSecret(secret: string) {
    if (secret !== internalAuthSecret()) {
        throw new Error("Unauthorized.")
    }
}

export const generateUploadUrl = mutation({
    args: {
        secret: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return await ctx.storage.generateUploadUrl()
    },
})

export const getUrl = query({
    args: {
        secret: v.string(),
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return await ctx.storage.getUrl(args.storageId)
    },
})
