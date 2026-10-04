import {
    TEAM_SEARCH_MAX,
    teamRecordPageSchema,
    teamRecordSchema,
    type TeamCreateInput,
    type TeamGame,
    type TeamLifecycleInput,
    type TeamRecord,
    type TeamUpdateInput,
} from "@/domain/teams/team"
import {
    IMAGE_INPUT_TYPES,
    IMAGE_MAX_INPUT_BYTES,
    imageAssetDtoSchema,
    type ImageAssetDto,
} from "@/domain/assets/image-asset"
import {
    matchTeamAssignmentSchema,
    type MatchTeamAssignment,
} from "@/domain/teams/match-teams"
import { z } from "zod"

/** Dashboard error vocabularies; each code has a localized message under `dictionary.teams`. */
export const TEAM_ERROR_CODES = [
    "invalid_team",
    "game_disabled",
    "duplicate_name",
    "revision_conflict",
    "idempotency_conflict",
    "not_found",
    "archived",
    "not_archived",
    "asset_unavailable",
    "limit_reached",
    "forbidden",
    "rate_limited",
    "unavailable",
] as const
export type TeamErrorCode = (typeof TEAM_ERROR_CODES)[number]

export const UPLOAD_ERROR_CODES = [
    "unsupported_type",
    "type_mismatch",
    "bad_dimensions",
    "animated",
    "undecodable",
    "invalid_kind",
    "invalid_asset",
    "too_large",
    "upload_limited",
    "forbidden",
    "unavailable",
] as const
export type UploadErrorCode = (typeof UPLOAD_ERROR_CODES)[number]

export const MATCH_TEAM_ERROR_CODES = [
    "invalid_match_teams",
    "team_not_found",
    "team_archived",
    "team_game_mismatch",
    "match_concluded",
    "training_event",
    "forbidden",
    "rate_limited",
    "unavailable",
] as const
export type MatchTeamErrorCode = (typeof MATCH_TEAM_ERROR_CODES)[number]
/** Codes the event save returns for a rejected `matchTeams` payload. */
export const MATCH_TEAM_SAVE_ERROR_CODES = [
    "invalid_match_teams",
    "team_not_found",
    "team_archived",
    "team_game_mismatch",
    "match_concluded",
    "training_event",
] as const satisfies readonly MatchTeamErrorCode[]
export type MatchTeamSaveErrorCode =
    (typeof MATCH_TEAM_SAVE_ERROR_CODES)[number]

function readString(body: unknown, key: string): string | null {
    const value =
        body && typeof body === "object" && key in body
            ? (body as Record<string, unknown>)[key]
            : null
    return typeof value === "string" ? value : null
}
function narrow<T extends string>(
    body: unknown,
    known: readonly T[],
    fallback: T
): T {
    const code = readString(body, "error")
    return code && (known as readonly string[]).includes(code)
        ? (code as T)
        : fallback
}
export const teamErrorCode = (body: unknown) =>
    narrow(body, TEAM_ERROR_CODES, "unavailable")
export const uploadErrorCode = (body: unknown) =>
    narrow(body, UPLOAD_ERROR_CODES, "unavailable")
export const matchTeamErrorCode = (body: unknown) =>
    narrow(body, MATCH_TEAM_ERROR_CODES, "unavailable")
/** A match-team rule violation from the event save, or `null` for any other failure. */
export function matchTeamSaveErrorCode(
    body: unknown
): MatchTeamSaveErrorCode | null {
    const code = readString(body, "error")
    return code &&
        (MATCH_TEAM_SAVE_ERROR_CODES as readonly string[]).includes(code)
        ? (code as MatchTeamSaveErrorCode)
        : null
}

export function teamsEndpoint(serverId: string) {
    return `/api/servers/${encodeURIComponent(serverId)}/teams`
}
export function teamLogoUploadEndpoint(serverId: string) {
    return `/api/servers/${encodeURIComponent(serverId)}/image-assets?kind=team-logo`
}
export function matchTeamsEndpoint(serverId: string, eventId: string) {
    return `/api/servers/${encodeURIComponent(serverId)}/events/${encodeURIComponent(eventId)}/match-teams`
}

export type TeamListQuery = {
    gameId: TeamGame
    archived: boolean
    search?: string
    cursor?: string | null
    limit?: number
}
/** Omits defaults so the route applies its own; a blank search is not sent. */
export function teamListUrl(serverId: string, query: TeamListQuery) {
    const params = new URLSearchParams({ game: query.gameId })
    if (query.archived) params.set("archived", "true")
    const search = query.search?.trim().slice(0, TEAM_SEARCH_MAX)
    if (search) params.set("search", search)
    if (query.cursor) params.set("cursor", query.cursor)
    if (query.limit !== undefined) params.set("limit", String(query.limit))
    return `${teamsEndpoint(serverId)}?${params.toString()}`
}

/** A failed directory read carrying a localizable code. */
export class TeamRequestError extends Error {
    constructor(readonly code: TeamErrorCode) {
        super(code)
        this.name = "TeamRequestError"
    }
}

export async function fetchTeamPage(
    serverId: string,
    query: TeamListQuery,
    signal?: AbortSignal
): Promise<z.infer<typeof teamRecordPageSchema>> {
    const response = await fetch(teamListUrl(serverId, query), {
        cache: "no-store",
        signal,
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) throw new TeamRequestError(teamErrorCode(body))
    const page = teamRecordPageSchema.safeParse(body)
    if (!page.success) throw new TeamRequestError("unavailable")
    return page.data
}

const teamLookupSchema = z.object({ team: teamRecordSchema })
/** One directory record by ID; `null` when it is gone, an error when the lookup fails. */
export async function fetchTeamRecord(
    serverId: string,
    teamId: string,
    signal?: AbortSignal
): Promise<TeamRecord | null> {
    const response = await fetch(
        `${teamsEndpoint(serverId)}?teamId=${encodeURIComponent(teamId)}`,
        { cache: "no-store", signal }
    )
    const body: unknown = await response.json().catch(() => null)
    if (response.status === 404) return null
    if (!response.ok) throw new TeamRequestError(teamErrorCode(body))
    const lookup = teamLookupSchema.safeParse(body)
    if (!lookup.success) throw new TeamRequestError("unavailable")
    return lookup.data.team
}

export type TeamCommandRequest =
    | { action: "create"; input: TeamCreateInput }
    | { action: "update"; teamId: string; input: TeamUpdateInput }
    | {
          action: "archive" | "restore"
          teamId: string
          input: TeamLifecycleInput
      }
export type TeamCommandResult =
    | { ok: true; teamId: string | null }
    | { ok: false; code: TeamErrorCode; existingId: string | null }

/** Sends one same-origin directory command; network failures read as `unavailable`. */
export async function sendTeamCommand(
    serverId: string,
    command: TeamCommandRequest
): Promise<TeamCommandResult> {
    let response: Response
    try {
        response = await fetch(teamsEndpoint(serverId), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(command),
        })
    } catch {
        return { ok: false, code: "unavailable", existingId: null }
    }
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok)
        return {
            ok: false,
            code: teamErrorCode(body),
            existingId: readString(body, "existingId"),
        }
    return { ok: true, teamId: readString(body, "teamId") }
}

export type TeamRestoreResult =
    { ok: true; team: TeamRecord } | { ok: false; code: TeamErrorCode }

/**
 * Restores an archived team at the revision the caller has seen and returns
 * the re-read record, so a duplicate-name conflict can reuse the existing team.
 */
export async function restoreTeam(
    serverId: string,
    team: Pick<TeamRecord, "id" | "revision">
): Promise<TeamRestoreResult> {
    const result = await sendTeamCommand(serverId, {
        action: "restore",
        teamId: team.id,
        input: { expectedRevision: team.revision },
    })
    if (!result.ok) return { ok: false, code: result.code }
    const restored = await fetchTeamRecord(serverId, team.id).catch(() => null)
    return restored && !restored.archivedAt
        ? { ok: true, team: restored }
        : { ok: false, code: "unavailable" }
}

export type LogoUploadResult =
    { ok: true; asset: ImageAssetDto } | { ok: false; code: UploadErrorCode }

/** Checks type and size locally, then posts the raw bytes to the team-logo upload route. */
export async function uploadTeamLogo(
    serverId: string,
    file: Blob
): Promise<LogoUploadResult> {
    if (!(IMAGE_INPUT_TYPES as readonly string[]).includes(file.type))
        return { ok: false, code: "unsupported_type" }
    if (file.size > IMAGE_MAX_INPUT_BYTES)
        return { ok: false, code: "too_large" }
    let response: Response
    try {
        response = await fetch(teamLogoUploadEndpoint(serverId), {
            method: "POST",
            headers: { "content-type": file.type },
            body: file,
        })
    } catch {
        return { ok: false, code: "unavailable" }
    }
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) return { ok: false, code: uploadErrorCode(body) }
    const asset = imageAssetDtoSchema.safeParse(
        body && typeof body === "object" && "asset" in body
            ? (body as { asset?: unknown }).asset
            : null
    )
    return asset.success && asset.data.kind === "team-logo"
        ? { ok: true, asset: asset.data }
        : { ok: false, code: "unavailable" }
}

const matchTeamsRefreshResponseSchema = z.object({
    ok: z.literal(true),
    matchTeams: z.array(matchTeamAssignmentSchema),
})
export type MatchTeamRefreshResult =
    | { ok: true; matchTeams: MatchTeamAssignment[] }
    | { ok: false; code: MatchTeamErrorCode }

/** Explicitly re-captures one saved assignment's snapshot from its active directory entry. */
export async function requestMatchTeamRefresh(
    serverId: string,
    eventId: string,
    teamId: string
): Promise<MatchTeamRefreshResult> {
    let response: Response
    try {
        response = await fetch(matchTeamsEndpoint(serverId, eventId), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "refresh", teamId }),
        })
    } catch {
        return { ok: false, code: "unavailable" }
    }
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) return { ok: false, code: matchTeamErrorCode(body) }
    const parsed = matchTeamsRefreshResponseSchema.safeParse(body)
    return parsed.success
        ? { ok: true, matchTeams: parsed.data.matchTeams }
        : { ok: false, code: "unavailable" }
}
