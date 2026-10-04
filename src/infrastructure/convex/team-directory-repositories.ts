import type {
    MatchTeamSnapshotPorts,
    TeamAuditDetails,
    TeamDirectoryRepository,
    TeamLogoPort,
    TeamWrite,
} from "@/application/teams/ports"
import {
    TEAM_DIRECTORY_LIMIT,
    teamSearchText,
    type TeamAuditOperation,
    type TeamEntity,
    type TeamGame,
} from "@/domain/teams/team"
import {
    assetPublicUrl,
    attachableAsset,
    syncAssetReferences,
} from "../../../convex/imageAssets"
import type {
    DirectoryTeamLookup,
    MatchTeamAssignment,
} from "@/domain/teams/match-teams"
import { appendIntegrationChange } from "../../../convex/integrationChangeLog"
import type { MutationCtx, QueryCtx } from "../../../convex/_generated/server"
import type { Doc, Id } from "../../../convex/_generated/dataModel"

type Db = Pick<QueryCtx, "db">

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

/** Directory facts for match-team resolution, keyed by the requested IDs. */
export async function directoryLookup(
    ctx: Db,
    teamIds: readonly string[]
): Promise<Map<string, DirectoryTeamLookup>> {
    const result = new Map<string, DirectoryTeamLookup>()
    for (const teamId of new Set(teamIds)) {
        const id = ctx.db.normalizeId("teamDirectory", teamId)
        const row = id ? await ctx.db.get(id) : null
        if (!row) continue
        // Foreign teams are returned so the domain can answer team_not_found.
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
    return result
}

/** Appends one directory audit entry in the caller's transaction. */
export async function recordTeamAudit(
    ctx: MutationCtx,
    team: Pick<TeamEntity, "id" | "guildId" | "gameId" | "revision">,
    operation: TeamAuditOperation,
    actor: string,
    details: TeamAuditDetails = {}
) {
    const teamId = ctx.db.normalizeId("teamDirectory", team.id)
    if (!teamId) throw new Error("Team not found.")
    await ctx.db.insert("teamDirectoryAudit", {
        guildId: team.guildId,
        gameId: team.gameId,
        teamId,
        operation,
        revision: team.revision,
        actor,
        ...details,
        createdAt: new Date().toISOString(),
    })
}

function assetId(ctx: Db, id: string | null): Id<"imageAssets"> | null {
    if (id === null) return null
    const normalized = ctx.db.normalizeId("imageAssets", id)
    if (!normalized) throw new Error("Invalid logo asset.")
    return normalized
}

export class ConvexTeamDirectoryRepository implements TeamDirectoryRepository {
    constructor(private readonly ctx: MutationCtx) {}

    async findCreate(guildId: string, idempotencyKey: string) {
        const row = await this.ctx.db
            .query("teamDirectoryAudit")
            .withIndex("guildId_idempotencyKey", (q) =>
                q.eq("guildId", guildId).eq("idempotencyKey", idempotencyKey)
            )
            .unique()
        return row
            ? {
                  teamId: String(row.teamId),
                  revision: row.revision,
                  fingerprint: row.fingerprint ?? null,
              }
            : null
    }

    async findByNormalizedName(
        guildId: string,
        gameId: TeamGame,
        normalizedName: string
    ) {
        const row = await this.ctx.db
            .query("teamDirectory")
            .withIndex("guildId_gameId_normalizedName", (q) =>
                q
                    .eq("guildId", guildId)
                    .eq("gameId", gameId)
                    .eq("normalizedName", normalizedName)
            )
            .unique()
        return row ? teamEntity(row) : null
    }

    async count(guildId: string, gameId: TeamGame) {
        return (
            await this.ctx.db
                .query("teamDirectory")
                .withIndex("guildId_gameId_normalizedName", (q) =>
                    q.eq("guildId", guildId).eq("gameId", gameId)
                )
                .take(TEAM_DIRECTORY_LIMIT + 1)
        ).length
    }

    async get(guildId: string, teamId: string) {
        const row = await teamById(this.ctx, guildId, teamId)
        return row ? teamEntity(row) : null
    }

    async insert(team: Omit<TeamEntity, "id">, actor: string) {
        const id = await this.ctx.db.insert("teamDirectory", {
            ...team,
            logoAssetId: assetId(this.ctx, team.logoAssetId),
            searchText: teamSearchText(team.name, team.shortCode),
            createdBy: actor,
            updatedBy: actor,
        })
        return teamEntity((await this.ctx.db.get(id))!)
    }

    async update(team: TeamEntity, write: TeamWrite, actor: string) {
        const id = this.ctx.db.normalizeId("teamDirectory", team.id)
        if (!id) throw new Error("Team not found.")
        const { logoAssetId, ...fields } = write
        const relabelled =
            write.name !== undefined || write.shortCode !== undefined
        await this.ctx.db.patch(id, {
            ...fields,
            ...(logoAssetId !== undefined
                ? { logoAssetId: assetId(this.ctx, logoAssetId) }
                : {}),
            ...(relabelled
                ? {
                      searchText: teamSearchText(
                          write.name ?? team.name,
                          write.shortCode === undefined
                              ? team.shortCode
                              : write.shortCode
                      ),
                  }
                : {}),
            updatedBy: actor,
        })
        return teamEntity((await this.ctx.db.get(id))!)
    }

    async audit(
        team: TeamEntity,
        operation: TeamAuditOperation,
        actor: string,
        details?: TeamAuditDetails
    ) {
        await recordTeamAudit(this.ctx, team, operation, actor, details)
    }

    async emit(team: TeamEntity, operation: "upsert" | "remove") {
        await appendIntegrationChange(this.ctx, {
            guildId: team.guildId,
            gameId: team.gameId,
            resource: "teams",
            id: team.id,
            operation,
        })
    }
}

export class ConvexTeamLogoPort implements TeamLogoPort {
    constructor(private readonly ctx: MutationCtx) {}

    async attachable(guildId: string, assetId: string) {
        const asset = await attachableAsset(this.ctx, {
            assetId,
            guildId,
            kind: "team-logo",
        })
        return asset ? String(asset._id) : null
    }

    async syncReferences(
        guildId: string,
        teamId: string,
        assetIds: readonly string[]
    ) {
        await syncAssetReferences(this.ctx, {
            guildId,
            owner: "team",
            ownerId: teamId,
            assetIds: assetIds.map((id) => assetId(this.ctx, id)!),
        })
    }
}

/** Keeps snapshot logos alive for as long as the event references them. */
export async function syncEventAssetReferences(
    ctx: MutationCtx,
    event: Pick<Doc<"events">, "_id" | "guildId" | "matchTeams">
) {
    const assetIds: Id<"imageAssets">[] = []
    for (const assignment of event.matchTeams ?? []) {
        const id = assignment.snapshot.logoAssetId
            ? ctx.db.normalizeId("imageAssets", assignment.snapshot.logoAssetId)
            : null
        if (id && !assetIds.includes(id)) assetIds.push(id)
    }
    await syncAssetReferences(ctx, {
        guildId: event.guildId,
        owner: "event",
        ownerId: String(event._id),
        assetIds,
    })
}

/** Event persistence for an explicit snapshot refresh, inside the caller's transaction. */
export class ConvexMatchTeamSnapshotPorts implements MatchTeamSnapshotPorts {
    constructor(private readonly ctx: MutationCtx) {}

    async lookupTeam(teamId: string) {
        return (await directoryLookup(this.ctx, [teamId])).get(teamId)
    }

    async saveAssignments(
        eventId: string,
        matchTeams: MatchTeamAssignment[],
        updatedAt: string
    ) {
        const id = this.ctx.db.normalizeId("events", eventId)
        const event = id ? await this.ctx.db.get(id) : null
        if (!event) throw new Error("Event not found.")
        await this.ctx.db.patch(event._id, { matchTeams, updatedAt })
        await syncEventAssetReferences(this.ctx, { ...event, matchTeams })
    }

    async auditRefresh(
        guildId: string,
        teamId: string,
        actor: string,
        eventId: string
    ) {
        const row = await teamById(this.ctx, guildId, teamId)
        if (row)
            await recordTeamAudit(
                this.ctx,
                teamEntity(row),
                "snapshot_refresh",
                actor,
                { eventId }
            )
    }
}
