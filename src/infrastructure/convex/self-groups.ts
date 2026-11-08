import type { SelfGroupPolicyPort } from "@/application/assignments/self-assign-group"
import { selfAssignableGroupIdsSchema } from "@/domain/assignments/self-groups"
import type { MutationCtx, QueryCtx } from "../../../convex/_generated/server"
import { resolveGameScope } from "@/domain/games/game"

export async function validateSelfAssignableGroups(
    ctx: QueryCtx | MutationCtx,
    guildId: string,
    value: unknown
) {
    const ids = selfAssignableGroupIdsSchema.parse(value)
    for (const id of ids) {
        const normalized = ctx.db.normalizeId("groups", id)
        const group = normalized ? await ctx.db.get(normalized) : null
        if (!group || group.guildId !== guildId)
            throw new Error("self_groups:not_allowed")
    }
    return ids
}

export class ConvexSelfGroupPolicy implements SelfGroupPolicyPort {
    constructor(private readonly ctx: QueryCtx | MutationCtx) {}
    async allowedGroupIds(guildId: string, gameId: string) {
        return (await selfGroupOptions(this.ctx, guildId))
            .filter((group) => group.gameId === gameId)
            .map((group) => group.id)
    }
}

export async function selfGroupOptions(
    ctx: QueryCtx | MutationCtx,
    guildId: string
) {
    const config = await ctx.db
        .query("discordConfigs")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
    const allowed = new Set(config?.selfAssignableGroupIds ?? [])
    const groups = await ctx.db
        .query("groups")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .collect()
    return groups
        .filter((group) => allowed.has(String(group._id)))
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        .map((group) => ({
            id: String(group._id),
            name: group.name,
            gameId: resolveGameScope(group.gameId),
        }))
}
