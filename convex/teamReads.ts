import {
    TEAM_PAGE_MAX,
    teamGameSchema,
    type TeamDto,
} from "../src/domain/teams/team"
import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import { teamById } from "../src/infrastructure/convex/team-directory-repositories"
import { assertSessionGateway } from "./dashboardSessionStore"
import { query, type QueryCtx } from "./_generated/server"
import { teamDtoOf } from "./teams"
import { v } from "convex/values"

const credentials = {
    secret: v.string(),
    keyHash: v.string(),
    guildId: v.string(),
    gameId: v.string(),
}

/** Key revocation, workspace and game grants are rechecked here, never only at the gateway. */
async function grant(
    ctx: Pick<QueryCtx, "db">,
    args: { secret: string; keyHash: string; guildId: string; gameId: string }
) {
    assertSessionGateway(args.secret)
    const game = teamGameSchema.safeParse(args.gameId)
    if (!game.success) return null
    const key = await ctx.db
        .query("apiKeys")
        .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
        .unique()
    if (
        !key ||
        key.revokedAt ||
        key.guildId !== args.guildId ||
        !isApiKeyReadAccess(key.readAccess) ||
        !allowsApiKeyRead(key.readAccess, "teams", game.data)
    )
        return null
    return game.data
}

/** Active directory entry as a website DTO; archived or foreign records read as absent. */
export async function readTeamDto(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    gameId: string,
    id: string
): Promise<TeamDto | null> {
    const row = await teamById(ctx, guildId, id)
    return row && row.gameId === gameId && !row.archivedAt
        ? await teamDtoOf(ctx, row)
        : null
}

export const list = query({
    args: {
        ...credentials,
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        const gameId = await grant(ctx, args)
        if (!gameId) return null
        if (
            !Number.isInteger(args.limit) ||
            args.limit < 1 ||
            args.limit > TEAM_PAGE_MAX ||
            (args.cursor?.length ?? 0) > 4096
        )
            throw new Error("Invalid pagination.")
        const page = await ctx.db
            .query("teamDirectory")
            .withIndex("guildId_gameId_archivedAt_normalizedName", (q) =>
                q
                    .eq("guildId", args.guildId)
                    .eq("gameId", gameId)
                    .eq("archivedAt", null)
            )
            .paginate({ cursor: args.cursor, numItems: args.limit })
        return {
            items: await Promise.all(
                page.page.map((row) => teamDtoOf(ctx, row))
            ),
            nextCursor: page.isDone ? null : page.continueCursor,
        }
    },
})

export const get = query({
    args: { ...credentials, id: v.string() },
    handler: async (ctx, args) => {
        const gameId = await grant(ctx, args)
        if (!gameId) return null
        return { team: await readTeamDto(ctx, args.guildId, gameId, args.id) }
    },
})
