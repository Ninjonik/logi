import {
    TEAM_PAGE_DEFAULT,
    TEAM_PAGE_MAX,
    teamGameSchema,
    type TeamGame,
} from "@/domain/teams/team"
import { createHmac, timingSafeEqual } from "node:crypto"

export type TeamCollectionQuery = {
    gameId: TeamGame
    cursor: string | null
    limit: number
}
export type TeamDetailQuery = { gameId: TeamGame }

const TEAM_CURSOR_MAX = 4096
/** Opaque record identifiers: bounded and free of path, encoding and whitespace characters. */
const TEAM_ID_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/

/** Exactly one `game` parameter naming a directory game; no legacy default or combination. */
function parseSingleGame(params: URLSearchParams): TeamGame | null {
    if (params.getAll("game").length !== 1) return null
    const game = teamGameSchema.safeParse(params.get("game"))
    return game.success ? game.data : null
}
function hasOnlyKeys(params: URLSearchParams, allowed: readonly string[]) {
    return [...params.keys()].every((key) => allowed.includes(key))
}

export function parseTeamCollectionQuery(
    request: Request
): TeamCollectionQuery | null {
    const params = new URL(request.url).searchParams
    const gameId = parseSingleGame(params)
    if (
        !gameId ||
        !hasOnlyKeys(params, ["game", "cursor", "limit"]) ||
        params.getAll("cursor").length > 1 ||
        params.getAll("limit").length > 1
    )
        return null
    const raw = params.get("limit") ?? String(TEAM_PAGE_DEFAULT),
        cursor = params.get("cursor")
    if (
        !/^\d{1,3}$/.test(raw) ||
        Number(raw) < 1 ||
        Number(raw) > TEAM_PAGE_MAX ||
        (cursor !== null && (!cursor || cursor.length > TEAM_CURSOR_MAX))
    )
        return null
    return { gameId, cursor, limit: Number(raw) }
}

/** What a collection cursor is issued for: one workspace and one directory game. */
export type TeamCursorBinding = {
    secret: string
    guildId: string
    gameId: TeamGame
}
function teamCursorSignature(binding: TeamCursorBinding, body: string) {
    return createHmac("sha256", binding.secret)
        .update(
            `logi-teams-cursor-v1:${JSON.stringify([binding.guildId, binding.gameId])}:${body}`
        )
        .digest()
}
/**
 * Wraps a Convex page cursor so it is valid only for the workspace and game
 * it was issued for; a forged or reused cursor is a client error, never a
 * Convex failure.
 */
export function sealTeamCursor(
    binding: TeamCursorBinding,
    cursor: string
): string {
    const body = Buffer.from(cursor, "utf8").toString("base64url")
    return `${body}.${teamCursorSignature(binding, body).toString("base64url")}`
}
/** The Convex cursor inside a sealed value, or null when this binding did not issue it. */
export function openTeamCursor(
    binding: TeamCursorBinding,
    sealed: string
): string | null {
    const [body, signature, ...rest] = sealed.split(".")
    if (!body || !signature || rest.length) return null
    const given = Buffer.from(signature, "base64url"),
        expected = teamCursorSignature(binding, body)
    if (given.length !== expected.length || !timingSafeEqual(given, expected))
        return null
    return Buffer.from(body, "base64url").toString("utf8") || null
}

export function parseTeamDetailQuery(request: Request): TeamDetailQuery | null {
    const params = new URL(request.url).searchParams
    const gameId = parseSingleGame(params)
    return gameId && hasOnlyKeys(params, ["game"]) ? { gameId } : null
}

/** The decoded path segment must be an opaque identifier, never a traversal or separator sequence. */
export function parseTeamIdSegment(id: string): string | null {
    return TEAM_ID_SEGMENT.test(id) ? id : null
}

export const TEAM_READ_ERRORS = {
    invalid_query: 400,
    insufficient_scope: 403,
    not_found: 404,
    unavailable: 503,
} as const
export type TeamReadError = keyof typeof TEAM_READ_ERRORS

/** Generic envelopes: no team labels or foreign identifiers leak through errors. */
export function teamErrorResponse(
    code: TeamReadError,
    headers: Record<string, string>,
    message?: string
) {
    return Response.json(
        { error: message ? { code, message } : { code } },
        { status: TEAM_READ_ERRORS[code], headers }
    )
}
