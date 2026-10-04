import type {
    TeamProposal,
    TeamRequestEntity,
    TeamRequestStatus,
} from "../../domain/teams/team-request"
import type {
    DirectoryTeamLookup,
    MatchTeamAssignment,
} from "../../domain/teams/match-teams"
import type {
    TeamAuditOperation,
    TeamEntity,
    TeamGame,
} from "../../domain/teams/team"

/** Facts recorded with a catalogue audit entry. */
export type TeamAuditDetails = {
    idempotencyKey?: string
    fingerprint?: string
    eventId?: string
    requestId?: string
    mergedIntoTeamId?: string
}

/** The stored fields a catalogue write may change; the adapter maintains derived search text. */
export type TeamWrite = Partial<
    Pick<
        TeamEntity,
        | "name"
        | "shortCode"
        | "logoAssetId"
        | "description"
        | "links"
        | "linkedGuildId"
        | "mergedIntoTeamId"
        | "normalizedName"
        | "archivedAt"
    >
> &
    Pick<TeamEntity, "revision" | "updatedAt">

/** Global catalogue persistence inside the caller's transaction; IDs stay opaque strings. */
export interface TeamDirectoryRepository {
    /** The create an administrator's idempotency key already produced, if any. */
    findCreate(idempotencyKey: string): Promise<{
        teamId: string
        revision: number
        fingerprint: string | null
    } | null>
    findByNormalizedName(
        gameId: TeamGame,
        normalizedName: string
    ): Promise<TeamEntity | null>
    /** Entries of one game, counted up to just past the catalogue limit. */
    count(gameId: TeamGame): Promise<number>
    get(teamId: string): Promise<TeamEntity | null>
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
    /** Appends the catalogue change record for every subscribed workspace in the same transaction. */
    emit(team: TeamEntity, operation: "upsert" | "remove"): Promise<void>
    /** Moves competition registrations, fixtures and pending requests from one team to another. */
    repoint(sourceTeamId: string, targetTeamId: string): Promise<void>
    /**
     * Whether both teams take part in one competition (both registered, or a
     * fixture between them): merging them would corrupt its divisions,
     * fixtures or standings.
     */
    competedTogether(teamId: string, otherTeamId: string): Promise<boolean>
}

/** Team-logo ownership: platform attach checks and the references that keep assets alive. */
export interface TeamLogoPort {
    /** The asset ID when the platform may attach it as a team logo; null otherwise. */
    attachable(assetId: string): Promise<string | null>
    /** Whether `adopt` would succeed; reads only, so a refused decision moves nothing. */
    adoptable(assetId: string, fromGuildId: string): Promise<string | null>
    /** Transfers a requesting workspace's logo to the platform on approval; null when not allowed. */
    adopt(assetId: string, fromGuildId: string): Promise<string | null>
    /** Replaces the team's logo references with exactly these assets. */
    syncReferences(teamId: string, assetIds: readonly string[]): Promise<void>
}

/** Request persistence inside the caller's transaction. */
export interface TeamRequestRepository {
    findSubmission(
        guildId: string,
        idempotencyKey: string
    ): Promise<{ requestId: string; fingerprint: string } | null>
    countPending(guildId: string): Promise<number>
    get(requestId: string): Promise<TeamRequestEntity | null>
    insert(
        request: Omit<
            TeamRequestEntity,
            | "id"
            | "status"
            | "reason"
            | "resultTeamId"
            | "decidedBy"
            | "decidedAt"
            | "updatedAt"
        > & { idempotencyKey: string; fingerprint: string }
    ): Promise<TeamRequestEntity>
    /** Records an outcome; decisions also queue the requester's DM. */
    decide(
        request: TeamRequestEntity,
        outcome: {
            status: Exclude<TeamRequestStatus, "pending">
            reason: string | null
            resultTeamId: string | null
            decidedBy: string | null
            decidedAt: string
            notify: boolean
        }
    ): Promise<TeamRequestEntity>
}

/** Request logos stay referenced by their request while it is pending. */
export interface TeamRequestLogoPort {
    /** The asset ID when the requesting workspace may attach it; null otherwise. */
    attachable(guildId: string, assetId: string): Promise<string | null>
    syncReferences(
        guildId: string,
        requestId: string,
        assetIds: readonly string[]
    ): Promise<void>
}

/** Event-side persistence for an explicit snapshot refresh. */
export interface MatchTeamSnapshotPorts {
    /** Catalogue facts after following merge pointers; undefined when unknown. */
    lookupTeam(teamId: string): Promise<DirectoryTeamLookup | undefined>
    /** Stores the event's assignments and their logo references together. */
    saveAssignments(
        eventId: string,
        matchTeams: MatchTeamAssignment[],
        updatedAt: string
    ): Promise<void>
    /** Audits the refresh on the catalogue entry when it still exists. */
    auditRefresh(teamId: string, actor: string, eventId: string): Promise<void>
}

export type { TeamProposal }
