import type {
    MatchTeamSnapshotPorts,
    TeamAuditDetails,
    TeamDirectoryRepository,
    TeamLogoPort,
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

export type InMemoryAudit = {
    teamId: string
    operation: TeamAuditOperation
    revision: number
    actor: string
} & TeamAuditDetails

/** Directory, audit and change records kept in memory for use-case tests. */
export class InMemoryTeamDirectory implements TeamDirectoryRepository {
    teams: TeamEntity[] = []
    audits: InMemoryAudit[] = []
    changes: { id: string; operation: "upsert" | "remove" }[] = []
    private sequence = 0

    async findCreate(guildId: string, idempotencyKey: string) {
        const audit = this.audits.find(
            (row) =>
                row.idempotencyKey === idempotencyKey &&
                this.teams.find((team) => team.id === row.teamId)?.guildId ===
                    guildId
        )
        return audit
            ? {
                  teamId: audit.teamId,
                  revision: audit.revision,
                  fingerprint: audit.fingerprint ?? null,
              }
            : null
    }
    async findByNormalizedName(
        guildId: string,
        gameId: TeamGame,
        normalizedName: string
    ) {
        return (
            this.teams.find(
                (team) =>
                    team.guildId === guildId &&
                    team.gameId === gameId &&
                    team.normalizedName === normalizedName
            ) ?? null
        )
    }
    async count(guildId: string, gameId: TeamGame) {
        return Math.min(
            this.teams.filter(
                (team) => team.guildId === guildId && team.gameId === gameId
            ).length,
            TEAM_DIRECTORY_LIMIT + 1
        )
    }
    async get(guildId: string, teamId: string) {
        return (
            this.teams.find(
                (team) => team.id === teamId && team.guildId === guildId
            ) ?? null
        )
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
}

/** Attachable logos by workspace, and the references each team holds. */
export class InMemoryTeamLogos implements TeamLogoPort {
    /** Team ID to the workspace and assets it references. */
    references = new Map<string, { guildId: string; assetIds: string[] }>()
    constructor(private readonly owned: Record<string, string>) {}
    async attachable(guildId: string, assetId: string) {
        return this.owned[assetId] === guildId ? assetId : null
    }
    async syncReferences(
        guildId: string,
        teamId: string,
        assetIds: readonly string[]
    ) {
        this.references.set(teamId, { guildId, assetIds: [...assetIds] })
    }
}

/** Event assignments, directory lookups and refresh audits held in memory. */
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
    async auditRefresh(
        guildId: string,
        teamId: string,
        actor: string,
        eventId: string
    ) {
        if (this.directory.get(teamId)?.guildId === guildId)
            this.audits.push({ teamId, actor, eventId })
    }
}
