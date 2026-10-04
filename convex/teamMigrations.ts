import { internalQuery } from "./_generated/server"
import { v } from "convex/values"

const LEGACY_SCAN = 2000

/**
 * Teams created while the catalogue was workspace-owned keep their old
 * `guildId` as provenance and already read as global entries. Two workspaces
 * may have created the same name for one game; this report lists those
 * collisions so a global administrator can merge them in the catalogue. It
 * changes nothing. Run once after deploying the global catalogue:
 * `npx convex run teamMigrations:legacyCollisionReport`.
 */
export const legacyCollisionReport = internalQuery({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const limit = Math.min(
            Math.max(args.limit ?? LEGACY_SCAN, 1),
            LEGACY_SCAN
        )
        const legacy = (
            await ctx.db
                .query("teamDirectory")
                .withIndex("guildId", (q) => q.gt("guildId", ""))
                .take(limit)
        ).filter((row) => !row.mergedIntoTeamId)
        const collisions = new Map<
            string,
            { gameId: string; normalizedName: string; teamIds: string[] }
        >()
        for (const row of legacy) {
            const key = `${row.gameId}:${row.normalizedName}`
            if (collisions.has(key)) continue
            const named = (
                await ctx.db
                    .query("teamDirectory")
                    .withIndex("gameId_normalizedName", (q) =>
                        q
                            .eq("gameId", row.gameId)
                            .eq("normalizedName", row.normalizedName)
                    )
                    .take(20)
            ).filter((entry) => !entry.mergedIntoTeamId)
            if (named.length > 1)
                collisions.set(key, {
                    gameId: row.gameId,
                    normalizedName: row.normalizedName,
                    teamIds: named.map((entry) => String(entry._id)),
                })
        }
        return {
            legacyTeams: legacy.length,
            truncated: legacy.length === limit,
            collisions: [...collisions.values()],
        }
    },
})
