import {
    TEAM_SEARCH_MAX,
    teamRecordPageSchema,
    teamRecordSchema,
    type TeamCreateInput,
    type TeamGame,
    type TeamLifecycleInput,
    type TeamMergeInput,
    type TeamRecord,
    type TeamUpdateInput,
} from "@/domain/teams/team"
import {
    teamRequestPageSchema,
    teamRequestRecordSchema,
    type TeamRequestDecision,
    type TeamRequestRecord,
    type TeamRequestStatus,
} from "@/domain/teams/team-request"
import {
    precheckImageFile,
    readImageUploadResponse,
    type ImageUploadResult,
} from "@/lib/image-asset-upload"
import { z } from "zod"

export const SUPERADMIN_TEAMS_ENDPOINT = "/api/superadmin/teams"
export const SUPERADMIN_TEAM_REQUESTS_ENDPOINT = "/api/superadmin/team-requests"
export const SUPERADMIN_IMAGE_ASSETS_ENDPOINT = "/api/superadmin/image-assets"

/** Every code the catalogue route answers with; each has a localized message. */
export const TEAM_ADMIN_ERROR_CODES = [
    "invalid_team",
    "invalid_query",
    "game_disabled",
    "duplicate_name",
    "revision_conflict",
    "idempotency_conflict",
    "not_found",
    "archived",
    "not_archived",
    "asset_unavailable",
    "limit_reached",
    "invalid_merge",
    "forbidden",
    "unavailable",
] as const
export type TeamAdminErrorCode = (typeof TEAM_ADMIN_ERROR_CODES)[number]

/** Every code the request moderation route answers with. */
export const TEAM_REQUEST_ADMIN_ERROR_CODES = [
    "invalid_request",
    "invalid_decision",
    "invalid_query",
    "not_found",
    "not_pending",
    "limit_reached",
    "idempotency_conflict",
    "team_archived",
    "team_game_mismatch",
    "duplicate_name",
    "revision_conflict",
    "archived",
    "not_archived",
    "asset_unavailable",
    "invalid_team",
    "invalid_merge",
    "game_disabled",
    "forbidden",
    "unavailable",
] as const
export type TeamRequestAdminErrorCode =
    (typeof TEAM_REQUEST_ADMIN_ERROR_CODES)[number]

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
/** An unknown or missing error code reads as `unavailable`. */
export const teamAdminErrorCode = (body: unknown) =>
    narrow(body, TEAM_ADMIN_ERROR_CODES, "unavailable")
export const teamRequestAdminErrorCode = (body: unknown) =>
    narrow(body, TEAM_REQUEST_ADMIN_ERROR_CODES, "unavailable")

/** A failed read carrying a localizable code. */
export class TeamAdminReadError<Code extends string = string> extends Error {
    constructor(readonly code: Code) {
        super(code)
        this.name = "TeamAdminReadError"
    }
}

export type AdminTeamListQuery = {
    gameId: TeamGame
    archived: boolean
    search?: string
    cursor?: string | null
    limit?: number
}
/** Omits defaults so the route applies its own; a blank search is not sent. */
export function adminTeamListUrl(query: AdminTeamListQuery): string {
    const params = new URLSearchParams({ game: query.gameId })
    if (query.archived) params.set("archived", "true")
    const search = query.search?.trim().slice(0, TEAM_SEARCH_MAX)
    if (search) params.set("search", search)
    if (query.cursor) params.set("cursor", query.cursor)
    if (query.limit !== undefined) params.set("limit", String(query.limit))
    return `${SUPERADMIN_TEAMS_ENDPOINT}?${params.toString()}`
}

type Fetcher = typeof fetch

export async function fetchAdminTeamPage(
    query: AdminTeamListQuery,
    options: { signal?: AbortSignal; fetcher?: Fetcher } = {}
): Promise<z.infer<typeof teamRecordPageSchema>> {
    const fetcher = options.fetcher ?? fetch
    const response = await fetcher(adminTeamListUrl(query), {
        cache: "no-store",
        signal: options.signal,
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok)
        throw new TeamAdminReadError<TeamAdminErrorCode>(
            teamAdminErrorCode(body)
        )
    const page = teamRecordPageSchema.safeParse(body)
    if (!page.success)
        throw new TeamAdminReadError<TeamAdminErrorCode>("unavailable")
    return page.data
}

const teamLookupSchema = z.object({ team: teamRecordSchema })
/** One catalogue record by ID; `null` when it is gone, an error when the lookup fails. */
export async function fetchAdminTeam(
    teamId: string,
    options: { signal?: AbortSignal; fetcher?: Fetcher } = {}
): Promise<TeamRecord | null> {
    const fetcher = options.fetcher ?? fetch
    const response = await fetcher(
        `${SUPERADMIN_TEAMS_ENDPOINT}?teamId=${encodeURIComponent(teamId)}`,
        { cache: "no-store", signal: options.signal }
    )
    const body: unknown = await response.json().catch(() => null)
    if (response.status === 404) return null
    if (!response.ok)
        throw new TeamAdminReadError<TeamAdminErrorCode>(
            teamAdminErrorCode(body)
        )
    const lookup = teamLookupSchema.safeParse(body)
    if (!lookup.success)
        throw new TeamAdminReadError<TeamAdminErrorCode>("unavailable")
    return lookup.data.team
}

export type AdminTeamCommand =
    | { action: "create"; input: TeamCreateInput }
    | { action: "update"; teamId: string; input: TeamUpdateInput }
    | {
          action: "archive" | "restore"
          teamId: string
          input: TeamLifecycleInput
      }
    | { action: "merge"; teamId: string; input: TeamMergeInput }
export type AdminCommandResult<Code extends string> =
    | { ok: true; teamId: string | null }
    | { ok: false; code: Code; existingId: string | null }

async function postJson<Code extends string>(
    url: string,
    body: unknown,
    readCode: (body: unknown) => Code,
    fetcher: Fetcher
): Promise<AdminCommandResult<Code | "unavailable">> {
    let response: Response
    try {
        response = await fetcher(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        })
    } catch {
        return { ok: false, code: "unavailable", existingId: null }
    }
    const parsed: unknown = await response.json().catch(() => null)
    if (!response.ok)
        return {
            ok: false,
            code: readCode(parsed),
            existingId: readString(parsed, "existingId"),
        }
    return { ok: true, teamId: readString(parsed, "teamId") }
}

/** Sends one same-origin catalogue command; network failures read as `unavailable`. */
export async function sendAdminTeamCommand(
    command: AdminTeamCommand,
    fetcher: Fetcher = fetch
): Promise<AdminCommandResult<TeamAdminErrorCode>> {
    return postJson(
        SUPERADMIN_TEAMS_ENDPOINT,
        command,
        teamAdminErrorCode,
        fetcher
    )
}

/**
 * Uploads a platform-owned team logo. The same local checks and error codes
 * as workspace uploads apply; an asset of any other kind is refused.
 */
export async function uploadPlatformTeamLogo(
    file: Blob,
    fetcher: Fetcher = fetch
): Promise<ImageUploadResult> {
    const rejected = precheckImageFile(file)
    if (rejected) return { ok: false, error: rejected, retryAfterMs: null }
    try {
        const response = await fetcher(
            `${SUPERADMIN_IMAGE_ASSETS_ENDPOINT}?kind=team-logo`,
            {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            }
        )
        const body: unknown = await response.json().catch(() => null)
        const result = readImageUploadResponse(
            response.status,
            body,
            response.headers.get("Retry-After")
        )
        return !result.ok || result.asset.kind === "team-logo"
            ? result
            : { ok: false, error: "unavailable", retryAfterMs: null }
    } catch {
        return { ok: false, error: "unavailable", retryAfterMs: null }
    }
}

export type TeamRequestQueueQuery = {
    status: TeamRequestStatus
    cursor?: string | null
    limit?: number
}
export function teamRequestQueueUrl(query: TeamRequestQueueQuery): string {
    const params = new URLSearchParams({ status: query.status })
    if (query.cursor) params.set("cursor", query.cursor)
    if (query.limit !== undefined) params.set("limit", String(query.limit))
    return `${SUPERADMIN_TEAM_REQUESTS_ENDPOINT}?${params.toString()}`
}

export async function fetchTeamRequestQueue(
    query: TeamRequestQueueQuery,
    options: { signal?: AbortSignal; fetcher?: Fetcher } = {}
): Promise<z.infer<typeof teamRequestPageSchema>> {
    const fetcher = options.fetcher ?? fetch
    const response = await fetcher(teamRequestQueueUrl(query), {
        cache: "no-store",
        signal: options.signal,
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok)
        throw new TeamAdminReadError<TeamRequestAdminErrorCode>(
            teamRequestAdminErrorCode(body)
        )
    const page = teamRequestPageSchema.safeParse(body)
    if (!page.success)
        throw new TeamAdminReadError<TeamRequestAdminErrorCode>("unavailable")
    return page.data
}

const requestLookupSchema = z.object({ request: teamRequestRecordSchema })
/** One request by ID; `null` when it is gone. */
export async function fetchTeamRequest(
    requestId: string,
    options: { signal?: AbortSignal; fetcher?: Fetcher } = {}
): Promise<TeamRequestRecord | null> {
    const fetcher = options.fetcher ?? fetch
    const response = await fetcher(
        `${SUPERADMIN_TEAM_REQUESTS_ENDPOINT}?requestId=${encodeURIComponent(requestId)}`,
        { cache: "no-store", signal: options.signal }
    )
    const body: unknown = await response.json().catch(() => null)
    if (response.status === 404) return null
    if (!response.ok)
        throw new TeamAdminReadError<TeamRequestAdminErrorCode>(
            teamRequestAdminErrorCode(body)
        )
    const lookup = requestLookupSchema.safeParse(body)
    if (!lookup.success)
        throw new TeamAdminReadError<TeamRequestAdminErrorCode>("unavailable")
    return lookup.data.request
}

/** Approves, merges or rejects one request; the result names the resulting team. */
export async function sendTeamRequestDecision(
    requestId: string,
    decision: TeamRequestDecision,
    fetcher: Fetcher = fetch
): Promise<AdminCommandResult<TeamRequestAdminErrorCode>> {
    return postJson(
        SUPERADMIN_TEAM_REQUESTS_ENDPOINT,
        { requestId, decision },
        teamRequestAdminErrorCode,
        fetcher
    )
}
