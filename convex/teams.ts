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
    mergeTeam,
    updateTeam,
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
import { authorizePlatformAdmin } from "./platformAdmin"
import type { Doc } from "./_generated/dataModel"
import { assetPublicUrl } from "./imageAssets"
import { v } from "convex/values"

/** Workspace-administrator reads: the catalogue is global but read in a workspace's dashboard. */
const workspaceAccess = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
/** Global-administrator access: no workspace, superadmin attestation required. */
const platformAccess = { secret: v.string(), actor: dashboardActor }
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

/**
 * One page of the catalogue for a game. `archived` includes archived and
 * merged entries (administration only); search is bounded and unpaged.
 */
async function readCatalogue(
    ctx: Db,
    args: {
        gameId: string
        archived: boolean
        search?: string
        cursor: string | null
        limit: number
    }
): Promise<{ items: TeamRecord[]; nextCursor: string | null }> {
    const gameId = parseGame(args.gameId)
    assertPagination(args.limit, args.cursor)
    const search = args.search?.trim().slice(0, TEAM_SEARCH_MAX)
    if (search) {
        const rows = await ctx.db
            .query("teamDirectory")
            .withSearchIndex("search", (q) => {
                const scoped = q
                    .search("searchText", search)
                    .eq("gameId", gameId)
                return args.archived ? scoped : scoped.eq("archivedAt", null)
            })
            .take(args.limit)
        return {
            items: await Promise.all(rows.map((row) => teamRecordOf(ctx, row))),
            nextCursor: null,
        }
    }
    const page = args.archived
        ? await ctx.db
              .query("teamDirectory")
              .withIndex("gameId_normalizedName", (q) => q.eq("gameId", gameId))
              .paginate({ cursor: args.cursor, numItems: args.limit })
        : await ctx.db
              .query("teamDirectory")
              .withIndex("gameId_archivedAt_normalizedName", (q) =>
                  q.eq("gameId", gameId).eq("archivedAt", null)
              )
              .paginate({ cursor: args.cursor, numItems: args.limit })
    return {
        items: await Promise.all(
            page.page.map((row) => teamRecordOf(ctx, row))
        ),
        nextCursor: page.isDone ? null : page.continueCursor,
    }
}

const listArgs = {
    gameId: v.string(),
    search: v.optional(v.string()),
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
}

/** Active catalogue teams of one game for a workspace's picker and Teams page. */
export const list = query({
    args: { ...workspaceAccess, ...listArgs },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        return await readCatalogue(ctx, { ...args, archived: false })
    },
})

/** One catalogue team for a workspace; archived and merged entries stay readable for history. */
export const get = query({
    args: { ...workspaceAccess, teamId: v.string() },
    handler: async (ctx, args): Promise<TeamRecord | null> => {
        await authorizeDashboardAdmin(ctx, args)
        const row = await teamById(ctx, args.teamId)
        return row ? await teamRecordOf(ctx, row) : null
    },
})

/** Global administration listing, optionally including archived and merged entries. */
export const adminList = query({
    args: { ...platformAccess, ...listArgs, archived: v.boolean() },
    handler: async (ctx, args) => {
        await authorizePlatformAdmin(ctx, args)
        return await readCatalogue(ctx, args)
    },
})

export const adminGet = query({
    args: { ...platformAccess, teamId: v.string() },
    handler: async (ctx, args): Promise<TeamRecord | null> => {
        await authorizePlatformAdmin(ctx, args)
        const row = await teamById(ctx, args.teamId)
        return row ? await teamRecordOf(ctx, row) : null
    },
})

/** Authorizes the global administrator in this transaction and wires the use-cases. */
async function catalogueWriter(
    ctx: MutationCtx,
    args: {
        secret: string
        actor: Parameters<typeof authorizePlatformAdmin>[1]["actor"]
    }
): Promise<{ ports: TeamDirectoryPorts; actor: string }> {
    const admin = await authorizePlatformAdmin(ctx, args)
    return {
        ports: {
            repository: new ConvexTeamDirectoryRepository(ctx),
            logos: new ConvexTeamLogoPort(ctx),
            now: () => new Date().toISOString(),
        },
        actor: admin.session.subject,
    }
}

/** Idempotent create: a retried key with the same payload replays the original result. */
export const create = mutation({
    args: { ...platformAccess, input: v.any() },
    handler: async (ctx, args) => {
        const { ports, actor } = await catalogueWriter(ctx, args)
        return await createTeam(ports, { actor }, args.input)
    },
})

export const update = mutation({
    args: { ...platformAccess, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => {
        const { ports, actor } = await catalogueWriter(ctx, args)
        return await updateTeam(ports, { actor }, args.teamId, args.input)
    },
})

/** Archive hides a team from new selection and the website catalogue; history keeps its snapshots. */
export const archive = mutation({
    args: { ...platformAccess, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => {
        const { ports, actor } = await catalogueWriter(ctx, args)
        return await changeTeamLifecycle(
            ports,
            { actor },
            args.teamId,
            args.input,
            "archive"
        )
    },
})
export const restore = mutation({
    args: { ...platformAccess, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => {
        const { ports, actor } = await catalogueWriter(ctx, args)
        return await changeTeamLifecycle(
            ports,
            { actor },
            args.teamId,
            args.input,
            "restore"
        )
    },
})

/** Merges a duplicate into the team that stays; see the use-case for what moves. */
export const merge = mutation({
    args: { ...platformAccess, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => {
        const { ports, actor } = await catalogueWriter(ctx, args)
        return await mergeTeam(ports, { actor }, args.teamId, args.input)
    },
})
