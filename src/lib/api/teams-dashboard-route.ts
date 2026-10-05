import {
    TEAM_PAGE_DEFAULT,
    TEAM_PAGE_MAX,
    TEAM_SEARCH_MAX,
    teamGameSchema,
    teamIdSchema,
    type TeamGame,
} from "@/domain/teams/team"
import { z } from "zod"

/**
 * A workspace catalogue read: one record by ID (any state, for history), or a
 * page of one game's active catalogue. Workspaces never write the catalogue.
 */
export type TeamsQuery =
    | { kind: "get"; teamId: string }
    | {
          kind: "list"
          gameId: TeamGame
          search?: string
          cursor: string | null
          limit: number
      }

const listQuerySchema = z.object({
    game: teamGameSchema,
    search: z
        .string()
        .trim()
        .max(TEAM_SEARCH_MAX)
        .optional()
        .transform((value) => value || undefined),
    cursor: z.string().min(1).max(4096).optional(),
    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(TEAM_PAGE_MAX)
        .default(TEAM_PAGE_DEFAULT),
})

/** `null` means the request is malformed; a bad `game` or an out-of-range limit is rejected, not clamped. */
export function parseTeamsQuery(params: URLSearchParams): TeamsQuery | null {
    const teamId = params.get("teamId")
    if (teamId !== null) {
        const parsed = teamIdSchema.safeParse(teamId)
        return parsed.success ? { kind: "get", teamId: parsed.data } : null
    }
    const parsed = listQuerySchema.safeParse({
        game: params.get("game") ?? undefined,
        search: params.get("search") ?? undefined,
        cursor: params.get("cursor") ?? undefined,
        limit: params.get("limit") ?? undefined,
    })
    if (!parsed.success) return null
    return {
        kind: "list",
        gameId: parsed.data.game,
        ...(parsed.data.search ? { search: parsed.data.search } : {}),
        cursor: parsed.data.cursor ?? null,
        limit: parsed.data.limit,
    }
}

/**
 * Requests per actor and workspace per minute across catalogue reads, team
 * requests and match snapshot refreshes; the picker's debounced search stays
 * well below.
 */
export const TEAM_DASHBOARD_RATE_LIMIT = 120
/** One bucket per workspace and dashboard actor, shared by every team route. */
export function teamDashboardRateBucket(guildId: string, subject: string) {
    return `teams:${guildId}:${subject}`
}
export type TeamDashboardRateLimit = {
    allowed: boolean
    retryAfterSeconds: number
}
/** The limited answer every team route returns before doing any work. */
export function teamRateLimitedResponse(rate: TeamDashboardRateLimit) {
    return Response.json(
        { error: "rate_limited" },
        {
            status: 429,
            headers: {
                "Cache-Control": "no-store",
                "Retry-After": String(
                    Math.max(1, Math.ceil(rate.retryAfterSeconds))
                ),
            },
        }
    )
}

export type TeamDashboardAccess = {
    guildId: string
    actor: { subject: string }
}
/** Admission shared by the workspace team routes. */
export type TeamDashboardGate<Access extends TeamDashboardAccess> = {
    /** Current workspace admin and dashboard actor; null denies the request. */
    access(serverId: string): Promise<Access | null>
    rateLimit(bucket: string): Promise<TeamDashboardRateLimit>
}

export const teamNoStore = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } })

/** Admin-only admission that consumes the actor's workspace bucket before any Convex call. */
export async function admitTeamDashboard<Access extends TeamDashboardAccess>(
    gate: TeamDashboardGate<Access>,
    serverId: string
): Promise<{ access: Access } | { denied: Response }> {
    const access = await gate.access(serverId)
    if (!access) return { denied: teamNoStore({ error: "forbidden" }, 403) }
    const rate = await gate.rateLimit(
        teamDashboardRateBucket(access.guildId, access.actor.subject)
    )
    return rate.allowed ? { access } : { denied: teamRateLimitedResponse(rate) }
}

export type TeamsDashboardPorts<Access extends TeamDashboardAccess> =
    TeamDashboardGate<Access> & {
        get(access: Access, teamId: string): Promise<unknown>
        list(
            access: Access,
            query: Extract<TeamsQuery, { kind: "list" }>
        ): Promise<unknown>
    }

/** Read-only catalogue route for a workspace dashboard; catalogue writes belong to global administrators. */
export function teamsDashboardHandlers<Access extends TeamDashboardAccess>(
    ports: TeamsDashboardPorts<Access>
) {
    return {
        /** `?teamId=` reads one record as `{ team }`; otherwise `?game=` pages one game's active catalogue. */
        async GET(request: Request, serverId: string): Promise<Response> {
            try {
                const admitted = await admitTeamDashboard(ports, serverId)
                if ("denied" in admitted) return admitted.denied
                const query = parseTeamsQuery(new URL(request.url).searchParams)
                if (!query) return teamNoStore({ error: "invalid_team" }, 400)
                if (query.kind === "get") {
                    const team = await ports.get(admitted.access, query.teamId)
                    return team
                        ? teamNoStore({ team })
                        : teamNoStore({ error: "not_found" }, 404)
                }
                return teamNoStore(await ports.list(admitted.access, query))
            } catch {
                return teamNoStore({ error: "unavailable" }, 503)
            }
        },
    }
}
