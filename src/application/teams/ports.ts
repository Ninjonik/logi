import type {
    DirectoryTeamLookup,
    MatchTeamAssignment,
} from "../../domain/teams/match-teams"
import type {
    TeamAuditOperation,
    TeamEntity,
    TeamGame,
} from "../../domain/teams/team"

/** Facts recorded with a directory audit entry. */
export type TeamAuditDetails = {
    idempotencyKey?: string
    fingerprint?: string
    eventId?: string
}

/** The stored fields a directory write may change; the adapter maintains derived search text. */
export type TeamWrite = Partial<
    Pick<
        TeamEntity,
        "name" | "shortCode" | "logoAssetId" | "normalizedName" | "archivedAt"
    >
> &
    Pick<TeamEntity, "revision" | "updatedAt">

/** Directory persistence inside the caller's transaction; IDs stay opaque strings. */
export interface TeamDirectoryRepository {
    /** The create an idempotency key already produced in this workspace, if any. */
    findCreate(
        guildId: string,
        idempotencyKey: string
    ): Promise<{
        teamId: string
        revision: number
        fingerprint: string | null
    } | null>
    findByNormalizedName(
        guildId: string,
        gameId: TeamGame,
        normalizedName: string
    ): Promise<TeamEntity | null>
    /** Entries of one game, counted up to just past the directory limit. */
    count(guildId: string, gameId: TeamGame): Promise<number>
    /** A workspace's record by ID; a foreign or unknown ID reads as absent. */
    get(guildId: string, teamId: string): Promise<TeamEntity | null>
    insert(team: Omit<TeamEntity, "id">, actor: string): Promise<TeamEntity>
    update(
        team: TeamEntity,
        write: TeamWrite,
        actor: string
    ): Promise<TeamEntity>
    audit(
        team: TeamEntity,
        operation: TeamAuditOperation,
        actor: string,
        details?: TeamAuditDetails
    ): Promise<void>
    /** Appends the directory change record in the same transaction. */
    emit(team: TeamEntity, operation: "upsert" | "remove"): Promise<void>
}

/** Team-logo ownership: attach checks and the indexed references that keep assets alive. */
export interface TeamLogoPort {
    /** The asset ID when this workspace may attach it as a team logo; null otherwise. */
    attachable(guildId: string, assetId: string): Promise<string | null>
    /** Replaces the team's logo references with exactly these assets. */
    syncReferences(
        guildId: string,
        teamId: string,
        assetIds: readonly string[]
    ): Promise<void>
}

/** Event-side persistence for an explicit snapshot refresh. */
export interface MatchTeamSnapshotPorts {
    /** Directory facts for any workspace; the domain rejects a foreign team. */
    lookupTeam(teamId: string): Promise<DirectoryTeamLookup | undefined>
    /** Stores the event's assignments and their logo references together. */
    saveAssignments(
        eventId: string,
        matchTeams: MatchTeamAssignment[],
        updatedAt: string
    ): Promise<void>
    /** Audits the refresh on the directory entry when it still exists. */
    auditRefresh(
        guildId: string,
        teamId: string,
        actor: string,
        eventId: string
    ): Promise<void>
}
