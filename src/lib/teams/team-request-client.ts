import {
    teamRequestPageSchema,
    type TeamRequestError,
    type TeamRequestRecord,
    type TeamRequestSubmit,
} from "@/domain/teams/team-request"
import { narrowErrorCode, readString } from "@/lib/teams/team-client"
import type { TeamCommandError } from "@/domain/teams/team"
import type { Dictionary } from "@/i18n/dictionaries"
import { z } from "zod"

/** Every TeamRequestError; checked for completeness at compile time. */
const REQUEST_ERRORS = {
    invalid_request: true,
    not_found: true,
    not_pending: true,
    limit_reached: true,
    idempotency_conflict: true,
    team_archived: true,
    team_game_mismatch: true,
    invalid_decision: true,
} as const satisfies Record<TeamRequestError, true>
/** Every TeamCommandError; a submission can surface catalogue errors such as an unavailable logo. */
const CATALOGUE_ERRORS = {
    invalid_team: true,
    game_disabled: true,
    duplicate_name: true,
    revision_conflict: true,
    idempotency_conflict: true,
    not_found: true,
    archived: true,
    not_archived: true,
    asset_unavailable: true,
    limit_reached: true,
    invalid_merge: true,
} as const satisfies Record<TeamCommandError, true>
const TRANSPORT_ERRORS = ["forbidden", "rate_limited", "unavailable"] as const

export type TeamRequestClientError =
    TeamRequestError | TeamCommandError | (typeof TRANSPORT_ERRORS)[number]
/** Every code the request route can answer with, request vocabulary first. */
export const TEAM_REQUEST_CLIENT_ERRORS: readonly TeamRequestClientError[] = [
    ...new Set<TeamRequestClientError>([
        ...(Object.keys(REQUEST_ERRORS) as TeamRequestError[]),
        ...(Object.keys(CATALOGUE_ERRORS) as TeamCommandError[]),
        ...TRANSPORT_ERRORS,
    ]),
]
export const teamRequestErrorCode = (body: unknown) =>
    narrowErrorCode(body, TEAM_REQUEST_CLIENT_ERRORS, "unavailable")

/**
 * The localized message for a request failure. Request codes (including the
 * pending-request limit and idempotency conflicts) read from
 * `teamRequests.errors`; catalogue codes fall back to `teams.errors`.
 */
export function teamRequestErrorMessage(
    dictionary: Dictionary,
    code: TeamRequestClientError
): string {
    const requestMessages: Readonly<Record<string, string>> =
        dictionary.teamRequests.errors
    const catalogueMessages: Readonly<Record<string, string>> =
        dictionary.teams.errors
    return (
        requestMessages[code] ??
        catalogueMessages[code] ??
        dictionary.teamRequests.errors.unavailable
    )
}

export function teamRequestsEndpoint(serverId: string) {
    return `/api/servers/${encodeURIComponent(serverId)}/team-requests`
}
export function teamRequestListUrl(
    serverId: string,
    query: { cursor?: string | null; limit?: number } = {}
) {
    const params = new URLSearchParams()
    if (query.cursor) params.set("cursor", query.cursor)
    if (query.limit !== undefined) params.set("limit", String(query.limit))
    const search = params.toString()
    return search
        ? `${teamRequestsEndpoint(serverId)}?${search}`
        : teamRequestsEndpoint(serverId)
}

export type TeamRequestPageResult =
    | { ok: true; items: TeamRequestRecord[]; nextCursor: string | null }
    | { ok: false; code: TeamRequestClientError }

/** One page of this workspace's requests, newest first, validated before use. */
export async function fetchTeamRequestPage(
    serverId: string,
    query: { cursor?: string | null; limit?: number } = {},
    signal?: AbortSignal
): Promise<TeamRequestPageResult> {
    let response: Response
    try {
        response = await fetch(teamRequestListUrl(serverId, query), {
            cache: "no-store",
            signal,
        })
    } catch {
        return { ok: false, code: "unavailable" }
    }
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) return { ok: false, code: teamRequestErrorCode(body) }
    const page = teamRequestPageSchema.safeParse(body)
    return page.success
        ? { ok: true, ...page.data }
        : { ok: false, code: "unavailable" }
}

async function postCommand(
    serverId: string,
    command: unknown
): Promise<
    { ok: true; body: unknown } | { ok: false; code: TeamRequestClientError }
> {
    let response: Response
    try {
        response = await fetch(teamRequestsEndpoint(serverId), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(command),
        })
    } catch {
        return { ok: false, code: "unavailable" }
    }
    const body: unknown = await response.json().catch(() => null)
    return response.ok
        ? { ok: true, body }
        : { ok: false, code: teamRequestErrorCode(body) }
}

const submittedSchema = z.object({
    ok: z.literal(true),
    requestId: z.string().min(1),
    replayed: z.boolean(),
})
export type TeamRequestSubmitResult =
    | { ok: true; requestId: string; replayed: boolean }
    | { ok: false; code: TeamRequestClientError }

/**
 * Sends a new-team or change request. A retry with the same idempotency key
 * and payload replays the stored request instead of creating a second one;
 * network failures read as `unavailable` so the caller can retry safely.
 */
export async function submitTeamRequest(
    serverId: string,
    input: TeamRequestSubmit
): Promise<TeamRequestSubmitResult> {
    const result = await postCommand(serverId, { action: "submit", input })
    if (!result.ok) return result
    const parsed = submittedSchema.safeParse(result.body)
    return parsed.success
        ? {
              ok: true,
              requestId: parsed.data.requestId,
              replayed: parsed.data.replayed,
          }
        : { ok: false, code: "unavailable" }
}

export type TeamRequestCancelResult =
    { ok: true } | { ok: false; code: TeamRequestClientError }

/** Withdraws one of this workspace's pending requests. */
export async function cancelTeamRequest(
    serverId: string,
    requestId: string
): Promise<TeamRequestCancelResult> {
    const result = await postCommand(serverId, {
        action: "cancel",
        requestId,
    })
    if (!result.ok) return result
    return readString(result.body, "error") === null
        ? { ok: true }
        : { ok: false, code: "unavailable" }
}
