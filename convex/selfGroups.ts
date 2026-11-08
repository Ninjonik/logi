import {
    ConvexAssignmentCommandRepository,
    ConvexAssignmentRosterSyncPort,
} from "../src/infrastructure/convex/assignment-command-repositories"
import {
    ConvexSelfGroupPolicy,
    selfGroupOptions,
} from "../src/infrastructure/convex/self-groups"
import { SelfAssignGroupUseCase } from "../src/application/assignments/self-assign-group"
import { gameLabel, resolveGameScope } from "../src/domain/games/game"
import { systemClock } from "../src/domain/shared/clock"
import { assertInternalSecret } from "./publicApiShared"
import { mutation } from "./integrationMutation"
import { query } from "./_generated/server"
import { v } from "convex/values"

export const options = query({
    args: { secret: v.string(), guildId: v.string(), userId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const [groups, assignments, config, catalog] = await Promise.all([
            selfGroupOptions(ctx, args.guildId),
            ctx.db
                .query("userAssignments")
                .withIndex("serverId_userId", (q) =>
                    q.eq("serverId", args.guildId).eq("userId", args.userId)
                )
                .collect(),
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .unique(),
            ctx.db.query("gameCatalog").collect(),
        ])
        return {
            language: config?.defaultLanguage ?? "en",
            style: config?.messageStyle,
            games: [
                ...new Set(
                    assignments
                        .filter(
                            (item) => item.status !== "pending" && !item.paused
                        )
                        .map((item) => resolveGameScope(item.gameId))
                ),
            ]
                .sort()
                .map((id) => ({
                    id,
                    name:
                        catalog.find((game) => game.id === id)?.name ??
                        gameLabel(id),
                })),
            groups: groups.flatMap((group) => {
                const assignment = assignments.find(
                    (item) =>
                        resolveGameScope(item.gameId) === group.gameId &&
                        item.status !== "pending" &&
                        !item.paused
                )
                if (!assignment || assignment.primaryGroupId === group.id)
                    return []
                return [
                    {
                        ...group,
                        selected: (assignment.secondaryGroupIds ?? []).some(
                            (id) => String(id) === group.id
                        ),
                    },
                ]
            }),
        }
    },
})

/** Trusted Discord adapter: the handler supplies interaction.user.id, never a target option. */
export const set = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userId: v.string(),
        groupId: v.id("groups"),
        enabled: v.boolean(),
        gameId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const group = await ctx.db.get(args.groupId)
        if (
            !group ||
            group.guildId !== args.guildId ||
            (args.gameId !== undefined &&
                args.gameId !== resolveGameScope(group.gameId))
        )
            throw new Error("self_groups:not_allowed")
        return new SelfAssignGroupUseCase(
            new ConvexAssignmentCommandRepository(ctx),
            new ConvexAssignmentRosterSyncPort(ctx),
            systemClock,
            new ConvexSelfGroupPolicy(ctx)
        ).execute({
            ...args,
            groupId: String(args.groupId),
            gameId: resolveGameScope(group.gameId),
        })
    },
})
