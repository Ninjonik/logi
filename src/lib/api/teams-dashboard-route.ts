import {
    TEAM_PAGE_DEFAULT,
    TEAM_PAGE_MAX,
    TEAM_SEARCH_MAX,
    teamCreateSchema,
    teamGameSchema,
    teamIdSchema,
    teamLifecycleSchema,
    teamUpdateSchema,
    type TeamGame,
} from "@/domain/teams/team"
import { readBoundedJson } from "./request-json"
import { z } from "zod"

/** A dashboard directory read: one record by ID, or a page of one game's entries. */
export type TeamsQuery =
    | { kind: "get"; teamId: string }
    | {
          kind: "list"
          gameId: TeamGame
          archived: boolean
          search?: string
          cursor: string | null
          limit: number
      }

const flag = z.enum(["true", "false"]).transform((value) => value === "true")
const listQuerySchema = z.object({
    game: teamGameSchema,
    archived: flag.default(false),
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
        archived: params.get("archived") ?? undefined,
        search: params.get("search") ?? undefined,
        cursor: params.get("cursor") ?? undefined,
        limit: params.get("limit") ?? undefined,
    })
    if (!parsed.success) return null
    return {
        kind: "list",
        gameId: parsed.data.game,
        archived: parsed.data.archived,
        ...(parsed.data.search ? { search: parsed.data.search } : {}),
        cursor: parsed.data.cursor ?? null,
        limit: parsed.data.limit,
    }
}

/** Dashboard write commands; each `input` is validated with the domain schema before Convex sees it. */
export const teamCommandSchema = z.discriminatedUnion("action", [
    z.strictObject({ action: z.literal("create"), input: teamCreateSchema }),
    z.strictObject({
        action: z.literal("update"),
        teamId: teamIdSchema,
        input: teamUpdateSchema,
    }),
    z.strictObject({
        action: z.literal("archive"),
        teamId: teamIdSchema,
        input: teamLifecycleSchema,
    }),
    z.strictObject({
        action: z.literal("restore"),
        teamId: teamIdSchema,
        input: teamLifecycleSchema,
    }),
])
export type TeamCommand = z.infer<typeof teamCommandSchema>

export const TEAM_MUTATION_FOR = {
    create: "teams:create",
    update: "teams:update",
    archive: "teams:archive",
    restore: "teams:restore",
} as const satisfies Record<TeamCommand["action"], string>

const CONFLICTS = new Set([
    "duplicate_name",
    "revision_conflict",
    "idempotency_conflict",
    "archived",
    "not_archived",
])

/** Maps a `TeamCommandError` to an HTTP status: conflicts 409, missing 404, everything else 400. */
export function teamErrorStatus(error: string): number {
    if (CONFLICTS.has(error)) return 409
    if (error === "not_found") return 404
    return 400
}

/** Turns a Convex command result into a response body and status, passing `existingId` through. */
export function teamCommandResponse(result: unknown): {
    body: unknown
    status: number
} {
    const record =
        result && typeof result === "object"
            ? (result as { error?: unknown; existingId?: unknown })
            : {}
    if (typeof record.error === "string") {
        return {
            body: {
                error: record.error,
                ...(typeof record.existingId === "string"
                    ? { existingId: record.existingId }
                    : {}),
            },
            status: teamErrorStatus(record.error),
        }
    }
    return { body: result, status: 200 }
}

/**
 * Requests per actor and workspace per minute across directory reads, writes
 * and match snapshot refreshes; the picker's debounced search stays well below.
 */
export const TEAM_DASHBOARD_RATE_LIMIT = 120
/** One bucket per workspace and dashboard actor, shared by every directory route. */
export function teamDashboardRateBucket(guildId: string, subject: string) {
    return `teams:${guildId}:${subject}`
}
export type TeamDashboardRateLimit = {
    allowed: boolean
    retryAfterSeconds: number
}
/** The limited answer every directory route returns before doing any work. */
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

type TeamDashboardAccess = { guildId: string; actor: { subject: string } }
export type TeamsDashboardPorts<Access extends TeamDashboardAccess> = {
    origin: string
    /** Current workspace admin and dashboard actor; null denies the request. */
    access(serverId: string): Promise<Access | null>
    rateLimit(bucket: string): Promise<TeamDashboardRateLimit>
    get(access: Access, teamId: string): Promise<unknown>
    list(
        access: Access,
        query: Extract<TeamsQuery, { kind: "list" }>
    ): Promise<unknown>
    command(
        access: Access,
        mutation: (typeof TEAM_MUTATION_FOR)[TeamCommand["action"]],
        payload: Omit<TeamCommand, "action">
    ): Promise<unknown>
}

const noStore = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } })

/**
 * Dashboard directory reads and writes. Each request is admin-only and
 * consumes the actor's workspace bucket before Convex is called; writes are
 * same-origin only.
 */
export function teamsDashboardHandlers<Access extends TeamDashboardAccess>(
    ports: TeamsDashboardPorts<Access>
) {
    async function admit(
        serverId: string
    ): Promise<{ access: Access } | { denied: Response }> {
        const access = await ports.access(serverId)
        if (!access) return { denied: noStore({ error: "forbidden" }, 403) }
        const rate = await ports.rateLimit(
            teamDashboardRateBucket(access.guildId, access.actor.subject)
        )
        return rate.allowed
            ? { access }
            : { denied: teamRateLimitedResponse(rate) }
    }
    return {
        /** `?teamId=` reads one record as `{ team }`; otherwise `?game=` pages one game's directory. */
        async GET(request: Request, serverId: string): Promise<Response> {
            try {
                const admitted = await admit(serverId)
                if ("denied" in admitted) return admitted.denied
                const query = parseTeamsQuery(new URL(request.url).searchParams)
                if (!query) return noStore({ error: "invalid_team" }, 400)
                if (query.kind === "get") {
                    const team = await ports.get(admitted.access, query.teamId)
                    return team
                        ? noStore({ team })
                        : noStore({ error: "not_found" }, 404)
                }
                return noStore(await ports.list(admitted.access, query))
            } catch {
                return noStore({ error: "unavailable" }, 503)
            }
        },
        async POST(request: Request, serverId: string): Promise<Response> {
            if (request.headers.get("origin") !== ports.origin)
                return noStore({ error: "forbidden" }, 403)
            try {
                const admitted = await admit(serverId)
                if ("denied" in admitted) return admitted.denied
                const command = teamCommandSchema.safeParse(
                    await readBoundedJson(request, 16384)
                )
                if (!command.success)
                    return noStore({ error: "invalid_team" }, 400)
                const { action, ...payload } = command.data
                const result = teamCommandResponse(
                    await ports.command(
                        admitted.access,
                        TEAM_MUTATION_FOR[action],
                        payload
                    )
                )
                return noStore(result.body, result.status)
            } catch {
                return noStore({ error: "unavailable" }, 503)
            }
        },
    }
}
