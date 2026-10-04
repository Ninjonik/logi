import {
    projectTeam,
    projectTeamRecord,
    TEAM_PAGE_MAX,
    TEAM_SEARCH_MAX,
    teamGameSchema,
    type TeamDto,
    type TeamGame,
    type TeamRecord,
} from "../src/domain/teams/team"
import {
    changeTeamLifecycle,
    createTeam,
    updateTeam,
    type TeamDirectoryActor,
    type TeamDirectoryPorts,
} from "../src/application/teams/team-directory.use-case"
import {
    ConvexTeamDirectoryRepository,
    ConvexTeamLogoPort,
    teamById,
    teamEntity,
} from "../src/infrastructure/convex/team-directory-repositories"
import {
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import type { Doc } from "./_generated/dataModel"
import { assetPublicUrl } from "./imageAssets"
import { v } from "convex/values"

const access = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
type Db = Pick<QueryCtx, "db">

export async function teamRecordOf(
    ctx: Db,
    row: Doc<"teamDirectory">
): Promise<TeamRecord> {
    return projectTeamRecord(
        teamEntity(row),
        await assetPublicUrl(ctx, row.logoAssetId)
    )
}
export async function teamDtoOf(
    ctx: Db,
    row: Doc<"teamDirectory">
): Promise<TeamDto> {
    return projectTeam(
        teamEntity(row),
        await assetPublicUrl(ctx, row.logoAssetId)
    )
}

function parseGame(value: string): TeamGame {
    const game = teamGameSchema.safeParse(value)
    if (!game.success) throw new Error("Invalid game.")
    return game.data
}
function assertPagination(limit: number, cursor: string | null) {
    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > TEAM_PAGE_MAX ||
        (cursor?.length ?? 0) > 4096
    )
        throw new Error("Invalid pagination.")
}

/** Active (or all, when `archived`) directory entries for one game, optionally searched. */
export const list = query({
    args: {
        ...access,
        gameId: v.string(),
        archived: v.boolean(),
        search: v.optional(v.string()),
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
    },
    handler: async (
        ctx,
        args
    ): Promise<{ items: TeamRecord[]; nextCursor: string | null }> => {
        await authorizeDashboardAdmin(ctx, args)
        const gameId = parseGame(args.gameId)
        assertPagination(args.limit, args.cursor)
        const search = args.search?.trim().slice(0, TEAM_SEARCH_MAX)
        if (search) {
            const rows = await ctx.db
                .query("teamDirectory")
                .withSearchIndex("search", (q) => {
                    const scoped = q
                        .search("searchText", search)
                        .eq("guildId", args.guildId)
                        .eq("gameId", gameId)
                    return args.archived
                        ? scoped
                        : scoped.eq("archivedAt", null)
                })
                .take(args.limit)
            return {
                items: await Promise.all(
                    rows.map((row) => teamRecordOf(ctx, row))
                ),
                nextCursor: null,
            }
        }
        const page = args.archived
            ? await ctx.db
                  .query("teamDirectory")
                  .withIndex("guildId_gameId_normalizedName", (q) =>
                      q.eq("guildId", args.guildId).eq("gameId", gameId)
                  )
                  .paginate({ cursor: args.cursor, numItems: args.limit })
            : await ctx.db
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
                page.page.map((row) => teamRecordOf(ctx, row))
            ),
            nextCursor: page.isDone ? null : page.continueCursor,
        }
    },
})

export const get = query({
    args: { ...access, teamId: v.string() },
    handler: async (ctx, args): Promise<TeamRecord | null> => {
        await authorizeDashboardAdmin(ctx, args)
        const row = await teamById(ctx, args.guildId, args.teamId)
        return row ? await teamRecordOf(ctx, row) : null
    },
})

/**
 * Authorizes the current workspace administrator in this transaction and
 * wires the directory use-cases to Convex persistence.
 */
async function directoryWriter(
    ctx: MutationCtx,
    args: {
        secret: string
        guildId: string
        actor: Parameters<typeof authorizeDashboardAdmin>[1]["actor"]
    }
): Promise<{ ports: TeamDirectoryPorts; scope: TeamDirectoryActor }> {
    const admin = await authorizeDashboardAdmin(ctx, args)
    return {
        ports: {
            repository: new ConvexTeamDirectoryRepository(ctx),
            logos: new ConvexTeamLogoPort(ctx),
            now: () => new Date().toISOString(),
        },
        scope: {
            guildId: args.guildId,
            actor: admin.session.subject,
            enabledGames: admin.server.enabledGames ?? ["hell_let_loose"],
        },
    }
}

/** Idempotent create: a retried key with the same payload replays the original result. */
export const create = mutation({
    args: { ...access, input: v.any() },
    handler: async (ctx, args) => {
        const { ports, scope } = await directoryWriter(ctx, args)
        return await createTeam(ports, scope, args.input)
    },
})

export const update = mutation({
    args: { ...access, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => {
        const { ports, scope } = await directoryWriter(ctx, args)
        return await updateTeam(ports, scope, args.teamId, args.input)
    },
})

/** Archive hides a team from new selection and the website directory; history keeps its snapshots. */
export const archive = mutation({
    args: { ...access, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => {
        const { ports, scope } = await directoryWriter(ctx, args)
        return await changeTeamLifecycle(
            ports,
            scope,
            args.teamId,
            args.input,
            "archive"
        )
    },
})
export const restore = mutation({
    args: { ...access, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => {
        const { ports, scope } = await directoryWriter(ctx, args)
        return await changeTeamLifecycle(
            ports,
            scope,
            args.teamId,
            args.input,
            "restore"
        )
    },
})
