import {
    TEAM_SEARCH_MAX,
    teamRecordPageSchema,
    teamRecordSchema,
    type TeamGame,
    type TeamRecord,
} from "@/domain/teams/team"
import {
    matchTeamAssignmentSchema,
    type MatchTeamAssignment,
} from "@/domain/teams/match-teams"
import {
    uploadImageAsset,
    type ImageUploadResult,
} from "@/lib/image-asset-upload"
import { z } from "zod"

/** Codes a catalogue read can fail with; each has a localized message under `dictionary.teams.errors`. */
export const TEAM_READ_ERROR_CODES = [
    "invalid_team",
    "not_found",
    "forbidden",
    "rate_limited",
    "unavailable",
] as const
export type TeamReadErrorCode = (typeof TEAM_READ_ERROR_CODES)[number]

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

export function readString(body: unknown, key: string): string | null {
    const value =
        body && typeof body === "object" && key in body
            ? (body as Record<string, unknown>)[key]
            : null
    return typeof value === "string" ? value : null
}
/** The response's `error` when it is one of `known`, else `fallback`. */
export function narrowErrorCode<T extends string>(
    body: unknown,
    known: readonly T[],
    fallback: T
): T {
    const code = readString(body, "error")
    return code && (known as readonly string[]).includes(code)
        ? (code as T)
        : fallback
}
export const teamReadErrorCode = (body: unknown) =>
    narrowErrorCode(body, TEAM_READ_ERROR_CODES, "unavailable")
export const matchTeamErrorCode = (body: unknown) =>
    narrowErrorCode(body, MATCH_TEAM_ERROR_CODES, "unavailable")
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
export function matchTeamsEndpoint(serverId: string, eventId: string) {
    return `/api/servers/${encodeURIComponent(serverId)}/events/${encodeURIComponent(eventId)}/match-teams`
}

/** One page of a game's active catalogue; workspaces never see archived or merged entries in a list. */
export type TeamListQuery = {
    gameId: TeamGame
    search?: string
    cursor?: string | null
    limit?: number
}
/** Omits defaults so the route applies its own; a blank search is not sent. */
export function teamListUrl(serverId: string, query: TeamListQuery) {
    const params = new URLSearchParams({ game: query.gameId })
    const search = query.search?.trim().slice(0, TEAM_SEARCH_MAX)
    if (search) params.set("search", search)
    if (query.cursor) params.set("cursor", query.cursor)
    if (query.limit !== undefined) params.set("limit", String(query.limit))
    return `${teamsEndpoint(serverId)}?${params.toString()}`
}

/** A failed catalogue read carrying a localizable code. */
export class TeamReadError extends Error {
    constructor(readonly code: TeamReadErrorCode) {
        super(code)
        this.name = "TeamReadError"
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
    if (!response.ok) throw new TeamReadError(teamReadErrorCode(body))
    const page = teamRecordPageSchema.safeParse(body)
    if (!page.success) throw new TeamReadError("unavailable")
    return page.data
}

const teamLookupSchema = z.object({ team: teamRecordSchema })
/**
 * One catalogue record by ID, including archived and merged entries so saved
 * selections keep their history; `null` when it is gone, an error when the
 * lookup fails.
 */
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
    if (!response.ok) throw new TeamReadError(teamReadErrorCode(body))
    const lookup = teamLookupSchema.safeParse(body)
    if (!lookup.success) throw new TeamReadError("unavailable")
    return lookup.data.team
}

/**
 * Uploads a request logo in the workspace's scope through the shared
 * image-asset client, so local checks, error codes and the rate-limit retry
 * hint match every other upload; an asset of any other kind is refused.
 */
export async function uploadTeamLogo(
    serverId: string,
    file: Blob,
    fetcher: typeof fetch = fetch
): Promise<ImageUploadResult> {
    const result = await uploadImageAsset(serverId, "team-logo", file, fetcher)
    return !result.ok || result.asset.kind === "team-logo"
        ? result
        : { ok: false, error: "unavailable", retryAfterMs: null }
}

const matchTeamsRefreshResponseSchema = z.object({
    ok: z.literal(true),
    matchTeams: z.array(matchTeamAssignmentSchema),
})
export type MatchTeamRefreshResult =
    | { ok: true; matchTeams: MatchTeamAssignment[] }
    | { ok: false; code: MatchTeamErrorCode }

/** Explicitly re-captures one saved assignment's snapshot from its catalogue entry. */
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
