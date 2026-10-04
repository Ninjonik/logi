import {
    decideTeamArchive,
    decideTeamCreate,
    decideTeamRestore,
    decideTeamUpdate,
    normalizeTeamName,
    projectTeam,
    projectTeamRecord,
    TEAM_DIRECTORY_LIMIT,
    TEAM_PAGE_MAX,
    TEAM_SEARCH_MAX,
    teamCreateFingerprint,
    teamCreateSchema,
    teamGameSchema,
    teamLifecycleSchema,
    teamSearchText,
    teamUpdateSchema,
    type TeamAuditOperation,
    type TeamCommandError,
    type TeamDto,
    type TeamEntity,
    type TeamGame,
    type TeamRecord,
} from "../src/domain/teams/team"
import {
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import {
    assetPublicUrl,
    attachableAsset,
    syncAssetReferences,
} from "./imageAssets"
import type { DirectoryTeamLookup } from "../src/domain/teams/match-teams"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { appendIntegrationChange } from "./integrationChangeLog"
import type { Doc, Id } from "./_generated/dataModel"
import { v } from "convex/values"

const access = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
type Db = Pick<QueryCtx, "db">
const fail = (error: TeamCommandError, existingId?: string) => ({
    error,
    ...(existingId ? { existingId } : {}),
})

export function teamEntity(row: Doc<"teamDirectory">): TeamEntity {
    return {
        id: String(row._id),
        guildId: row.guildId,
        gameId: row.gameId,
        name: row.name,
        shortCode: row.shortCode,
        logoAssetId: row.logoAssetId ? String(row.logoAssetId) : null,
        normalizedName: row.normalizedName,
        archivedAt: row.archivedAt,
        revision: row.revision,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

/** A workspace's record by ID; a foreign or unknown ID reads as absent. */
export async function teamById(
    ctx: Db,
    guildId: string,
    teamId: string
): Promise<Doc<"teamDirectory"> | null> {
    const id = ctx.db.normalizeId("teamDirectory", teamId)
    const row = id ? await ctx.db.get(id) : null
    return row && row.guildId === guildId ? row : null
}

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

/** Directory facts for match-team resolution, keyed by the requested IDs. */
export async function directoryLookup(
    ctx: Db,
    guildId: string,
    teamIds: readonly string[]
): Promise<Map<string, DirectoryTeamLookup>> {
    const result = new Map<string, DirectoryTeamLookup>()
    for (const teamId of new Set(teamIds)) {
        const id = ctx.db.normalizeId("teamDirectory", teamId)
        const row = id ? await ctx.db.get(id) : null
        if (!row) continue
        result.set(teamId, {
            id: teamId,
            guildId: row.guildId,
            gameId: row.gameId,
            name: row.name,
            shortCode: row.shortCode,
            logoAssetId: row.logoAssetId ? String(row.logoAssetId) : null,
            logoUrl: await assetPublicUrl(ctx, row.logoAssetId),
            revision: row.revision,
            archivedAt: row.archivedAt,
        })
    }
    void guildId
    return result
}

async function byNormalizedName(
    ctx: Db,
    guildId: string,
    gameId: TeamGame,
    normalizedName: string
) {
    return await ctx.db
        .query("teamDirectory")
        .withIndex("guildId_gameId_normalizedName", (q) =>
            q
                .eq("guildId", guildId)
                .eq("gameId", gameId)
                .eq("normalizedName", normalizedName)
        )
        .unique()
}

async function directoryCount(ctx: Db, guildId: string, gameId: TeamGame) {
    return (
        await ctx.db
            .query("teamDirectory")
            .withIndex("guildId_gameId_normalizedName", (q) =>
                q.eq("guildId", guildId).eq("gameId", gameId)
            )
            .take(TEAM_DIRECTORY_LIMIT + 1)
    ).length
}

async function audit(
    ctx: MutationCtx,
    row: Doc<"teamDirectory">,
    operation: TeamAuditOperation,
    actor: string,
    extra: {
        idempotencyKey?: string
        fingerprint?: string
        eventId?: string
    } = {}
) {
    await ctx.db.insert("teamDirectoryAudit", {
        guildId: row.guildId,
        gameId: row.gameId,
        teamId: row._id,
        operation,
        revision: row.revision,
        actor,
        ...extra,
        createdAt: new Date().toISOString(),
    })
}
export { audit as recordTeamAudit }

async function emit(
    ctx: MutationCtx,
    row: Doc<"teamDirectory">,
    operation: "upsert" | "remove"
) {
    await appendIntegrationChange(ctx, {
        guildId: row.guildId,
        gameId: row.gameId,
        resource: "teams",
        id: String(row._id),
        operation,
    })
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

async function resolveLogo(
    ctx: Db,
    guildId: string,
    logoAssetId: string | null
): Promise<{ id: Id<"imageAssets"> | null } | { error: "asset_unavailable" }> {
    if (!logoAssetId) return { id: null }
    const asset = await attachableAsset(ctx, {
        assetId: logoAssetId,
        guildId,
        kind: "team-logo",
    })
    return asset ? { id: asset._id } : { error: "asset_unavailable" }
}

/** Idempotent create: a retried key with the same payload replays the original result. */
export const create = mutation({
    args: { ...access, input: v.any() },
    handler: async (ctx, args) => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const parsed = teamCreateSchema.safeParse(args.input)
        if (!parsed.success) return fail("invalid_team")
        const input = parsed.data,
            fingerprint = teamCreateFingerprint(input)
        const replay = await ctx.db
            .query("teamDirectoryAudit")
            .withIndex("guildId_idempotencyKey", (q) =>
                q
                    .eq("guildId", args.guildId)
                    .eq("idempotencyKey", input.idempotencyKey)
            )
            .unique()
        if (replay) {
            if (replay.fingerprint !== fingerprint)
                return fail("idempotency_conflict")
            return {
                ok: true as const,
                teamId: String(replay.teamId),
                revision: replay.revision,
                replayed: true,
            }
        }
        const normalizedName = normalizeTeamName(input.name)
        const existing = await byNormalizedName(
            ctx,
            args.guildId,
            input.gameId,
            normalizedName
        )
        const decision = decideTeamCreate({
            guildId: args.guildId,
            enabledGames: admin.server.enabledGames ?? ["hell_let_loose"],
            input,
            existing: existing
                ? { id: String(existing._id), archivedAt: existing.archivedAt }
                : null,
            count: await directoryCount(ctx, args.guildId, input.gameId),
            now: new Date().toISOString(),
        })
        if (!decision.ok) return fail(decision.error, decision.existingId)
        const logo = await resolveLogo(
            ctx,
            args.guildId,
            decision.team.logoAssetId
        )
        if ("error" in logo) return fail(logo.error)
        const id = await ctx.db.insert("teamDirectory", {
            ...decision.team,
            logoAssetId: logo.id,
            searchText: teamSearchText(
                decision.team.name,
                decision.team.shortCode
            ),
            createdBy: admin.session.subject,
            updatedBy: admin.session.subject,
        })
        const row = (await ctx.db.get(id))!
        await syncAssetReferences(ctx, {
            guildId: args.guildId,
            owner: "team",
            ownerId: String(id),
            assetIds: logo.id ? [logo.id] : [],
        })
        await audit(ctx, row, "create", admin.session.subject, {
            idempotencyKey: input.idempotencyKey,
            fingerprint,
        })
        await emit(ctx, row, "upsert")
        return {
            ok: true as const,
            teamId: String(id),
            revision: row.revision,
            replayed: false,
        }
    },
})

export const update = mutation({
    args: { ...access, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const parsed = teamUpdateSchema.safeParse(args.input)
        if (!parsed.success) return fail("invalid_team")
        const row = await teamById(ctx, args.guildId, args.teamId)
        if (!row) return fail("not_found")
        const team = teamEntity(row)
        const conflicting = await byNormalizedName(
            ctx,
            args.guildId,
            row.gameId,
            normalizeTeamName(parsed.data.name ?? team.name)
        )
        const decision = decideTeamUpdate({
            team,
            input: parsed.data,
            conflicting: conflicting ? { id: String(conflicting._id) } : null,
            now: new Date().toISOString(),
        })
        if (!decision.ok) return fail(decision.error, decision.existingId)
        const logo =
            decision.patch.logoAssetId === team.logoAssetId
                ? { id: row.logoAssetId }
                : await resolveLogo(
                      ctx,
                      args.guildId,
                      decision.patch.logoAssetId
                  )
        if ("error" in logo) return fail(logo.error)
        await ctx.db.patch(row._id, {
            ...decision.patch,
            logoAssetId: logo.id,
            searchText: teamSearchText(
                decision.patch.name,
                decision.patch.shortCode
            ),
            updatedBy: admin.session.subject,
        })
        const updated = (await ctx.db.get(row._id))!
        // A replaced logo loses this reference; a match snapshot may still keep the asset alive.
        await syncAssetReferences(ctx, {
            guildId: args.guildId,
            owner: "team",
            ownerId: String(row._id),
            assetIds: logo.id ? [logo.id] : [],
        })
        await audit(ctx, updated, "update", admin.session.subject)
        await emit(ctx, updated, "upsert")
        return { ok: true as const, revision: updated.revision }
    },
})

async function lifecycle(
    ctx: MutationCtx,
    args: {
        secret: string
        guildId: string
        actor: Parameters<typeof authorizeDashboardAdmin>[1]["actor"]
        teamId: string
        input: unknown
    },
    operation: "archive" | "restore"
) {
    const admin = await authorizeDashboardAdmin(ctx, args)
    const parsed = teamLifecycleSchema.safeParse(args.input)
    if (!parsed.success) return fail("invalid_team")
    const row = await teamById(ctx, args.guildId, args.teamId)
    if (!row) return fail("not_found")
    const decide =
        operation === "archive" ? decideTeamArchive : decideTeamRestore
    const decision = decide({
        team: teamEntity(row),
        input: parsed.data,
        now: new Date().toISOString(),
    })
    if (!decision.ok) return fail(decision.error)
    await ctx.db.patch(row._id, {
        ...decision.patch,
        updatedBy: admin.session.subject,
    })
    const updated = (await ctx.db.get(row._id))!
    await audit(ctx, updated, operation, admin.session.subject)
    await emit(ctx, updated, operation === "archive" ? "remove" : "upsert")
    return { ok: true as const, revision: updated.revision }
}

/** Archive hides a team from new selection and the website directory; history keeps its snapshots. */
export const archive = mutation({
    args: { ...access, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => await lifecycle(ctx, args, "archive"),
})
export const restore = mutation({
    args: { ...access, teamId: v.string(), input: v.any() },
    handler: async (ctx, args) => await lifecycle(ctx, args, "restore"),
})
