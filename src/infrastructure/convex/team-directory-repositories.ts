import type {
    MatchTeamSnapshotPorts,
    TeamAuditDetails,
    TeamDirectoryRepository,
    TeamLogoPort,
    TeamRequestLogoPort,
    TeamRequestRepository,
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
    adoptPlatformLogo,
    assetPublicUrl,
    attachableAsset,
    syncAssetReferences,
} from "../../../convex/imageAssets"
import type {
    DirectoryTeamLookup,
    MatchTeamAssignment,
} from "@/domain/teams/match-teams"
import type {
    TeamRequestEntity,
    TeamRequestStatus,
} from "@/domain/teams/team-request"
import { appendIntegrationChange } from "../../../convex/integrationChangeLog"
import type { MutationCtx, QueryCtx } from "../../../convex/_generated/server"
import { allowsApiKeyRead, isApiKeyReadAccess } from "@/domain/api/key-access"
import type { Doc, Id } from "../../../convex/_generated/dataModel"
import { PLATFORM_SCOPE } from "../../../convex/platformAdmin"

type Db = Pick<QueryCtx, "db">
const MERGE_HOPS = 5

export function teamEntity(row: Doc<"teamDirectory">): TeamEntity {
    return {
        id: String(row._id),
        gameId: row.gameId,
        name: row.name,
        shortCode: row.shortCode,
        logoAssetId: row.logoAssetId ? String(row.logoAssetId) : null,
        description: row.description ?? null,
        links: row.links ?? [],
        linkedGuildId: row.linkedGuildId ?? null,
        mergedIntoTeamId: row.mergedIntoTeamId
            ? String(row.mergedIntoTeamId)
            : null,
        normalizedName: row.normalizedName,
        archivedAt: row.archivedAt,
        revision: row.revision,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

/** A catalogue record by ID; an unknown or malformed ID reads as absent. */
export async function teamById(
    ctx: Db,
    teamId: string
): Promise<Doc<"teamDirectory"> | null> {
    const id = ctx.db.normalizeId("teamDirectory", teamId)
    return id ? await ctx.db.get(id) : null
}

/** Follows merge pointers to the team that replaced this one (bounded). */
export async function currentTeam(
    ctx: Db,
    teamId: string
): Promise<Doc<"teamDirectory"> | null> {
    let row = await teamById(ctx, teamId)
    for (let hop = 0; row?.mergedIntoTeamId && hop < MERGE_HOPS; hop++)
        row = await ctx.db.get(row.mergedIntoTeamId)
    return row?.mergedIntoTeamId ? null : row
}

async function lookupOf(
    ctx: Db,
    row: Doc<"teamDirectory">
): Promise<DirectoryTeamLookup> {
    return {
        id: String(row._id),
        gameId: row.gameId,
        name: row.name,
        shortCode: row.shortCode,
        logoAssetId: row.logoAssetId ? String(row.logoAssetId) : null,
        logoUrl: await assetPublicUrl(ctx, row.logoAssetId),
        revision: row.revision,
        archivedAt: row.archivedAt,
    }
}

/** Catalogue facts for match-team resolution, keyed by the requested IDs. */
export async function directoryLookup(
    ctx: Db,
    teamIds: readonly string[]
): Promise<Map<string, DirectoryTeamLookup>> {
    const result = new Map<string, DirectoryTeamLookup>()
    for (const teamId of new Set(teamIds)) {
        const row = await teamById(ctx, teamId)
        if (row)
            result.set(teamId, { ...(await lookupOf(ctx, row)), id: teamId })
    }
    return result
}

/** Appends one catalogue audit entry in the caller's transaction. */
export async function recordTeamAudit(
    ctx: MutationCtx,
    team: Pick<TeamEntity, "id" | "gameId" | "revision">,
    operation: TeamAuditOperation,
    actor: string,
    details: TeamAuditDetails = {}
) {
    const teamId = ctx.db.normalizeId("teamDirectory", team.id)
    if (!teamId) throw new Error("Team not found.")
    await ctx.db.insert("teamDirectoryAudit", {
        guildId: PLATFORM_SCOPE,
        gameId: team.gameId,
        teamId,
        operation,
        revision: team.revision,
        actor,
        ...details,
        createdAt: new Date().toISOString(),
    })
}

/**
 * Workspaces whose API keys currently hold the `teams` grant for this game.
 * The catalogue is global, so its changes are appended to each subscribed
 * workspace's feed; new keys bootstrap from the collection.
 */
export async function teamFeedSubscribers(
    ctx: Db,
    gameId: TeamGame
): Promise<string[]> {
    const keys = await ctx.db.query("apiKeys").take(2000)
    return [
        ...new Set(
            keys
                .filter(
                    (key) =>
                        !key.revokedAt &&
                        isApiKeyReadAccess(key.readAccess) &&
                        allowsApiKeyRead(key.readAccess, "teams", gameId)
                )
                .map((key) => key.guildId)
        ),
    ].sort()
}

function assetId(ctx: Db, id: string | null): Id<"imageAssets"> | null {
    if (id === null) return null
    const normalized = ctx.db.normalizeId("imageAssets", id)
    if (!normalized) throw new Error("Invalid logo asset.")
    return normalized
}

export class ConvexTeamDirectoryRepository implements TeamDirectoryRepository {
    constructor(private readonly ctx: MutationCtx) {}

    async findCreate(idempotencyKey: string) {
        const row = await this.ctx.db
            .query("teamDirectoryAudit")
            .withIndex("guildId_idempotencyKey", (q) =>
                q
                    .eq("guildId", PLATFORM_SCOPE)
                    .eq("idempotencyKey", idempotencyKey)
            )
            .first()
        return row
            ? {
                  teamId: String(row.teamId),
                  revision: row.revision,
                  fingerprint: row.fingerprint ?? null,
              }
            : null
    }

    /** The entry that owns a name: never a merged record; an active one before an archived one. */
    async findByNormalizedName(gameId: TeamGame, normalizedName: string) {
        const rows = (
            await this.ctx.db
                .query("teamDirectory")
                .withIndex("gameId_normalizedName", (q) =>
                    q.eq("gameId", gameId).eq("normalizedName", normalizedName)
                )
                .take(10)
        ).filter((row) => !row.mergedIntoTeamId)
        const row = rows.find((entry) => !entry.archivedAt) ?? rows[0]
        return row ? teamEntity(row) : null
    }

    async count(gameId: TeamGame) {
        return (
            await this.ctx.db
                .query("teamDirectory")
                .withIndex("gameId_normalizedName", (q) =>
                    q.eq("gameId", gameId)
                )
                .take(TEAM_DIRECTORY_LIMIT + 1)
        ).length
    }

    async get(teamId: string) {
        const row = await teamById(this.ctx, teamId)
        return row ? teamEntity(row) : null
    }

    async insert(team: Omit<TeamEntity, "id">, actor: string) {
        const id = await this.ctx.db.insert("teamDirectory", {
            gameId: team.gameId,
            name: team.name,
            shortCode: team.shortCode,
            logoAssetId: assetId(this.ctx, team.logoAssetId),
            description: team.description,
            links: team.links,
            linkedGuildId: team.linkedGuildId,
            mergedIntoTeamId: null,
            normalizedName: team.normalizedName,
            searchText: teamSearchText(team.name, team.shortCode),
            archivedAt: team.archivedAt,
            revision: team.revision,
            createdAt: team.createdAt,
            updatedAt: team.updatedAt,
            createdBy: actor,
            updatedBy: actor,
        })
        return teamEntity((await this.ctx.db.get(id))!)
    }

    async update(team: TeamEntity, write: TeamWrite, actor: string) {
        const id = this.ctx.db.normalizeId("teamDirectory", team.id)
        if (!id) throw new Error("Team not found.")
        const { logoAssetId, mergedIntoTeamId, ...fields } = write
        const relabelled =
            write.name !== undefined || write.shortCode !== undefined
        await this.ctx.db.patch(id, {
            ...fields,
            ...(logoAssetId !== undefined
                ? { logoAssetId: assetId(this.ctx, logoAssetId) }
                : {}),
            ...(mergedIntoTeamId !== undefined
                ? {
                      mergedIntoTeamId: mergedIntoTeamId
                          ? this.ctx.db.normalizeId(
                                "teamDirectory",
                                mergedIntoTeamId
                            )
                          : null,
                  }
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
        for (const guildId of await teamFeedSubscribers(this.ctx, team.gameId))
            await appendIntegrationChange(this.ctx, {
                guildId,
                gameId: team.gameId,
                resource: "teams",
                id: team.id,
                operation,
            })
    }

    async repoint(sourceTeamId: string, targetTeamId: string) {
        const source = this.ctx.db.normalizeId("teamDirectory", sourceTeamId)
        const target = this.ctx.db.normalizeId("teamDirectory", targetTeamId)
        if (!source || !target) throw new Error("Team not found.")
        const now = new Date().toISOString()
        const registrations = await this.ctx.db
            .query("competitionTeams")
            .withIndex("teamId", (q) => q.eq("teamId", source))
            .collect()
        for (const registration of registrations) {
            const duplicate = await this.ctx.db
                .query("competitionTeams")
                .withIndex("competitionId_teamId", (q) =>
                    q
                        .eq("competitionId", registration.competitionId)
                        .eq("teamId", target)
                )
                .first()
            if (duplicate) await this.ctx.db.delete(registration._id)
            else
                await this.ctx.db.patch(registration._id, {
                    teamId: target,
                    updatedAt: now,
                })
        }
        for (const side of ["sideATeamId", "sideBTeamId"] as const) {
            const fixtures = await this.ctx.db
                .query("competitionFixtures")
                .withIndex(side, (q) => q.eq(side, source))
                .collect()
            for (const fixture of fixtures)
                await this.ctx.db.patch(fixture._id, {
                    [side]: target,
                    updatedAt: now,
                })
        }
        const pending = await this.ctx.db
            .query("teamRequests")
            .withIndex("teamId_status", (q) =>
                q.eq("teamId", source).eq("status", "pending")
            )
            .collect()
        for (const request of pending)
            await this.ctx.db.patch(request._id, {
                teamId: target,
                updatedAt: now,
            })
    }
}

/** Catalogue logos belong to the platform scope. */
export class ConvexTeamLogoPort implements TeamLogoPort {
    constructor(private readonly ctx: MutationCtx) {}

    async attachable(id: string) {
        const asset = await attachableAsset(this.ctx, {
            assetId: id,
            guildId: PLATFORM_SCOPE,
            kind: "team-logo",
        })
        return asset ? String(asset._id) : null
    }

    async adopt(id: string, fromGuildId: string) {
        const adopted = await adoptPlatformLogo(this.ctx, {
            assetId: id,
            fromGuildId,
        })
        return adopted ? String(adopted) : null
    }

    async syncReferences(teamId: string, assetIds: readonly string[]) {
        await syncAssetReferences(this.ctx, {
            guildId: PLATFORM_SCOPE,
            owner: "team",
            ownerId: teamId,
            assetIds: assetIds.map((id) => assetId(this.ctx, id)!),
        })
    }
}

export function teamRequestEntity(row: Doc<"teamRequests">): TeamRequestEntity {
    return {
        id: String(row._id),
        guildId: row.guildId,
        requestedBy: row.requestedBy,
        kind: row.kind,
        gameId: row.gameId,
        teamId: row.teamId ? String(row.teamId) : null,
        proposal: {
            ...row.proposal,
            logoAssetId: row.proposal.logoAssetId
                ? String(row.proposal.logoAssetId)
                : null,
        },
        note: row.note,
        status: row.status,
        reason: row.reason,
        resultTeamId: row.resultTeamId ? String(row.resultTeamId) : null,
        decidedBy: row.decidedBy,
        decidedAt: row.decidedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

export class ConvexTeamRequestRepository implements TeamRequestRepository {
    constructor(private readonly ctx: MutationCtx) {}

    async findSubmission(guildId: string, idempotencyKey: string) {
        const row = await this.ctx.db
            .query("teamRequests")
            .withIndex("guildId_idempotencyKey", (q) =>
                q.eq("guildId", guildId).eq("idempotencyKey", idempotencyKey)
            )
            .first()
        return row
            ? { requestId: String(row._id), fingerprint: row.fingerprint }
            : null
    }

    async countPending(guildId: string) {
        return (
            await this.ctx.db
                .query("teamRequests")
                .withIndex("guildId_status", (q) =>
                    q.eq("guildId", guildId).eq("status", "pending")
                )
                .take(100)
        ).length
    }

    async get(requestId: string) {
        const id = this.ctx.db.normalizeId("teamRequests", requestId)
        const row = id ? await this.ctx.db.get(id) : null
        return row ? teamRequestEntity(row) : null
    }

    async insert(
        request: Parameters<TeamRequestRepository["insert"]>[0]
    ): Promise<TeamRequestEntity> {
        const id = await this.ctx.db.insert("teamRequests", {
            guildId: request.guildId,
            requestedBy: request.requestedBy,
            kind: request.kind,
            gameId: request.gameId,
            teamId: request.teamId
                ? this.ctx.db.normalizeId("teamDirectory", request.teamId)
                : null,
            proposal: {
                ...request.proposal,
                logoAssetId: assetId(this.ctx, request.proposal.logoAssetId),
            },
            note: request.note,
            idempotencyKey: request.idempotencyKey,
            fingerprint: request.fingerprint,
            status: "pending",
            reason: null,
            resultTeamId: null,
            decidedBy: null,
            decidedAt: null,
            notificationStatus: "none",
            notificationAttempts: 0,
            notificationNextAttemptAt: null,
            notificationLeaseUntil: null,
            notificationSentAt: null,
            createdAt: request.createdAt,
            updatedAt: request.createdAt,
        })
        return teamRequestEntity((await this.ctx.db.get(id))!)
    }

    async decide(
        request: TeamRequestEntity,
        outcome: {
            status: Exclude<TeamRequestStatus, "pending">
            reason: string | null
            resultTeamId: string | null
            decidedBy: string | null
            decidedAt: string
            notify: boolean
        }
    ) {
        const id = this.ctx.db.normalizeId("teamRequests", request.id)
        if (!id) throw new Error("Request not found.")
        await this.ctx.db.patch(id, {
            status: outcome.status,
            reason: outcome.reason,
            resultTeamId: outcome.resultTeamId
                ? this.ctx.db.normalizeId("teamDirectory", outcome.resultTeamId)
                : null,
            decidedBy: outcome.decidedBy,
            decidedAt: outcome.decidedAt,
            updatedAt: outcome.decidedAt,
            ...(outcome.notify
                ? {
                      notificationStatus: "pending" as const,
                      notificationAttempts: 0,
                      notificationNextAttemptAt: Date.now(),
                      notificationLeaseUntil: null,
                  }
                : {}),
        })
        return teamRequestEntity((await this.ctx.db.get(id))!)
    }
}

/** Request logos are uploaded in the requesting workspace's scope. */
export class ConvexTeamRequestLogoPort implements TeamRequestLogoPort {
    constructor(private readonly ctx: MutationCtx) {}

    async attachable(guildId: string, id: string) {
        const asset = await attachableAsset(this.ctx, {
            assetId: id,
            guildId,
            kind: "team-logo",
        })
        return asset ? String(asset._id) : null
    }

    async syncReferences(
        guildId: string,
        requestId: string,
        assetIds: readonly string[]
    ) {
        await syncAssetReferences(this.ctx, {
            guildId,
            owner: "teamRequest",
            ownerId: requestId,
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
        const row = await currentTeam(this.ctx, teamId)
        return row ? await lookupOf(this.ctx, row) : undefined
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

    async auditRefresh(teamId: string, actor: string, eventId: string) {
        const row = await teamById(this.ctx, teamId)
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
