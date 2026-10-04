import {
    historyHead,
    projectHistory,
    readHistoryRecord,
} from "./gameHistoryStore"
import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import { dashboardActor, authorizeDashboardAdmin } from "./dashboardActor"
import { historyFiltersSchema } from "../src/domain/game-data/history"
import { assertSessionGateway } from "./dashboardSessionStore"
import { query } from "./_generated/server"
import { v } from "convex/values"

/** Retained history authorization is independent of the live provider/collector state. */
export const read = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        keyHash: v.optional(v.string()),
        actor: v.optional(dashboardActor),
        id: v.optional(v.string()),
        cursor: v.union(v.string(), v.null()),
        revision: v.optional(v.string()),
        filters: v.object({
            sourceId: v.optional(v.string()),
            map: v.optional(v.string()),
            from: v.optional(v.string()),
            until: v.optional(v.string()),
        }),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        if (args.keyHash !== undefined) {
            if (args.actor !== undefined) return null
            const key = await ctx.db
                .query("apiKeys")
                .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash!))
                .unique()
            if (
                !key ||
                key.revokedAt !== undefined ||
                key.guildId !== args.guildId ||
                !isApiKeyReadAccess(key.readAccess) ||
                !allowsApiKeyRead(
                    key.readAccess,
                    "server-game-history",
                    "wardogs"
                )
            )
                return null
        } else {
            if (!args.actor) return null
            try {
                await authorizeDashboardAdmin(ctx, {
                    ...args,
                    actor: args.actor,
                })
            } catch {
                return null
            }
        }
        const parsed = historyFiltersSchema.safeParse(args.filters)
        if (
            !parsed.success ||
            (args.cursor !== null &&
                (!args.revision || args.cursor.length > 4096))
        )
            return null
        if (args.id !== undefined)
            return readHistoryRecord(ctx, args.guildId, args.id)
        const filters = parsed.data,
            head = await historyHead(ctx, args.guildId),
            revision = head?.revision ?? "0"
        if (args.revision !== undefined && args.revision !== revision)
            return { resetRequired: true as const }
        const from = filters.from ?? "0000",
            until = filters.until ?? "9999"
        const rows = filters.sourceId
            ? ctx.db
                  .query("serverGameHistory")
                  .withIndex("guildId_sourceId_endedAt", (q) =>
                      q
                          .eq("guildId", args.guildId)
                          .eq("sourceId", filters.sourceId!)
                          .gte("endedAt", from)
                          .lt("endedAt", until)
                  )
            : ctx.db
                  .query("serverGameHistory")
                  .withIndex("guildId_endedAt", (q) =>
                      q
                          .eq("guildId", args.guildId)
                          .gte("endedAt", from)
                          .lt("endedAt", until)
                  )
        const page = await rows.order("desc").paginate({
            cursor: args.cursor,
            numItems: 20,
            maximumRowsRead: 20,
        })
        return {
            items: page.page
                .filter((row) => !filters.map || row.map === filters.map)
                .map(projectHistory),
            revision,
            nextCursor: page.isDone ? null : page.continueCursor,
            lastCollectedAt: head?.lastCollectedAt ?? null,
        }
    },
})
