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
    type TeamAuditOperation,
    type TeamEntity,
    type TeamGame,
} from "@/domain/teams/team"
import type {
    DirectoryTeamLookup,
    MatchTeamAssignment,
} from "@/domain/teams/match-teams"
import type {
    TeamRequestEntity,
    TeamRequestStatus,
} from "@/domain/teams/team-request"

export type InMemoryAudit = {
    teamId: string
    operation: TeamAuditOperation
    revision: number
    actor: string
} & TeamAuditDetails

/** Global catalogue, audit, change and repoint records kept in memory for use-case tests. */
export class InMemoryTeamDirectory implements TeamDirectoryRepository {
    teams: TeamEntity[] = []
    audits: InMemoryAudit[] = []
    changes: { id: string; operation: "upsert" | "remove" }[] = []
    repoints: { from: string; to: string }[] = []
    private sequence = 0

    async findCreate(idempotencyKey: string) {
        const audit = this.audits.find(
            (row) =>
                row.operation === "create" &&
                row.idempotencyKey === idempotencyKey
        )
        return audit
            ? {
                  teamId: audit.teamId,
                  revision: audit.revision,
                  fingerprint: audit.fingerprint ?? null,
              }
            : null
    }
    async findByNormalizedName(gameId: TeamGame, normalizedName: string) {
        const rows = this.teams.filter(
            (team) =>
                team.gameId === gameId &&
                team.normalizedName === normalizedName &&
                !team.mergedIntoTeamId
        )
        return rows.find((team) => !team.archivedAt) ?? rows[0] ?? null
    }
    async count(gameId: TeamGame) {
        return Math.min(
            this.teams.filter((team) => team.gameId === gameId).length,
            TEAM_DIRECTORY_LIMIT + 1
        )
    }
    async get(teamId: string) {
        const team = this.teams.find((entry) => entry.id === teamId)
        return team ? { ...team } : null
    }
    async insert(team: Omit<TeamEntity, "id">) {
        const stored = { ...team, id: `team-${++this.sequence}` }
        this.teams.push(stored)
        return { ...stored }
    }
    async update(team: TeamEntity, write: TeamWrite) {
        const stored = this.teams.find((entry) => entry.id === team.id)
        if (!stored) throw new Error("Team not found.")
        Object.assign(stored, write)
        return { ...stored }
    }
    async audit(
        team: TeamEntity,
        operation: TeamAuditOperation,
        actor: string,
        details: TeamAuditDetails = {}
    ) {
        this.audits.push({
            teamId: team.id,
            operation,
            revision: team.revision,
            actor,
            ...details,
        })
    }
    async emit(team: TeamEntity, operation: "upsert" | "remove") {
        this.changes.push({ id: team.id, operation })
    }
    async repoint(from: string, to: string) {
        this.repoints.push({ from, to })
    }
}

/**
 * Logo ownership by scope ("platform" or a workspace ID) and the references
 * each catalogue team holds.
 */
export class InMemoryTeamLogos implements TeamLogoPort {
    references = new Map<string, string[]>()
    constructor(readonly owned: Record<string, string>) {}
    async attachable(assetId: string) {
        return this.owned[assetId] === "platform" ? assetId : null
    }
    async adopt(assetId: string, fromGuildId: string) {
        const owner = this.owned[assetId]
        if (owner !== fromGuildId && owner !== "platform") return null
        this.owned[assetId] = "platform"
        return assetId
    }
    async syncReferences(teamId: string, assetIds: readonly string[]) {
        this.references.set(teamId, [...assetIds])
    }
}

/** Request rows and their pending DM state, held in memory. */
export class InMemoryTeamRequests implements TeamRequestRepository {
    requests: (TeamRequestEntity & {
        idempotencyKey: string
        fingerprint: string
        notification: "none" | "pending"
    })[] = []
    private sequence = 0
    async findSubmission(guildId: string, idempotencyKey: string) {
        const row = this.requests.find(
            (entry) =>
                entry.guildId === guildId &&
                entry.idempotencyKey === idempotencyKey
        )
        return row ? { requestId: row.id, fingerprint: row.fingerprint } : null
    }
    async countPending(guildId: string) {
        return this.requests.filter(
            (entry) => entry.guildId === guildId && entry.status === "pending"
        ).length
    }
    async get(requestId: string) {
        const row = this.requests.find((entry) => entry.id === requestId)
        if (!row) return null
        const { idempotencyKey, fingerprint, notification, ...entity } = row
        void idempotencyKey
        void fingerprint
        void notification
        return { ...entity }
    }
    async insert(request: Parameters<TeamRequestRepository["insert"]>[0]) {
        const stored = {
            ...request,
            id: `request-${++this.sequence}`,
            status: "pending" as const,
            reason: null,
            resultTeamId: null,
            decidedBy: null,
            decidedAt: null,
            updatedAt: request.createdAt,
            notification: "none" as const,
        }
        this.requests.push(stored)
        return (await this.get(stored.id))!
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
        const row = this.requests.find((entry) => entry.id === request.id)
        if (!row) throw new Error("Request not found.")
        Object.assign(row, {
            status: outcome.status,
            reason: outcome.reason,
            resultTeamId: outcome.resultTeamId,
            decidedBy: outcome.decidedBy,
            decidedAt: outcome.decidedAt,
            updatedAt: outcome.decidedAt,
            notification: outcome.notify ? "pending" : row.notification,
        })
        return (await this.get(row.id))!
    }
}

/** Request logo ownership per workspace and the references each request holds. */
export class InMemoryTeamRequestLogos implements TeamRequestLogoPort {
    references = new Map<string, string[]>()
    constructor(private readonly owned: Record<string, string>) {}
    async attachable(guildId: string, assetId: string) {
        return this.owned[assetId] === guildId ? assetId : null
    }
    async syncReferences(
        _guildId: string,
        requestId: string,
        assetIds: readonly string[]
    ) {
        this.references.set(requestId, [...assetIds])
    }
}

/** Event assignments, catalogue lookups and refresh audits held in memory. */
export class InMemoryMatchTeamSnapshots implements MatchTeamSnapshotPorts {
    saved = new Map<string, { matchTeams: MatchTeamAssignment[]; at: string }>()
    audits: { teamId: string; actor: string; eventId: string }[] = []
    constructor(readonly directory: Map<string, DirectoryTeamLookup>) {}
    async lookupTeam(teamId: string) {
        return this.directory.get(teamId)
    }
    async saveAssignments(
        eventId: string,
        matchTeams: MatchTeamAssignment[],
        updatedAt: string
    ) {
        this.saved.set(eventId, { matchTeams, at: updatedAt })
    }
    async auditRefresh(teamId: string, actor: string, eventId: string) {
        this.audits.push({ teamId, actor, eventId })
    }
}
