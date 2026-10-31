import { ConvexArticleRepository } from "../src/infrastructure/convex/article-repository"
import { ArticleCommands } from "../src/application/articles/article-commands"
import { systemClock } from "../src/domain/shared/clock"
import { mutation, query } from "./_generated/server"
import { internalAuthSecret } from "./discord_shared"
import { v } from "convex/values"
const check = (value: string) => {
    if (value !== internalAuthSecret()) throw new Error("Unauthorized.")
}
export const list = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        check(args.secret)
        return (
            await ctx.db
                .query("articles")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .collect()
        )
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((a) => ({ ...a, id: String(a._id) }))
    },
})
export const get = query({
    args: { secret: v.string(), articleId: v.id("articles") },
    handler: async (ctx, args) => {
        check(args.secret)
        const item = await ctx.db.get(args.articleId)
        return item ? { ...item, id: String(item._id) } : null
    },
})
export const save = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        authorId: v.string(),
        articleId: v.optional(v.id("articles")),
        title: v.string(),
        description: v.string(),
        tags: v.array(v.string()),
        body: v.string(),
        attachments: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        check(args.secret)
        const saved = await new ArticleCommands(
            new ConvexArticleRepository(ctx),
            systemClock
        ).save(args)
        return saved.id
    },
})
export const remove = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        articleId: v.id("articles"),
    },
    handler: async (ctx, args) => {
        check(args.secret)
        await new ArticleCommands(
            new ConvexArticleRepository(ctx),
            systemClock
        ).remove(args.guildId, args.articleId)
    },
})
