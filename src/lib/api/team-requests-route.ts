import {
    admitTeamDashboard,
    teamNoStore,
    type TeamDashboardAccess,
    type TeamDashboardGate,
} from "./teams-dashboard-route"
import {
    TEAM_REQUEST_PAGE_MAX,
    teamRequestSubmitSchema,
    type TeamRequestSubmit,
} from "@/domain/teams/team-request"
import { readBoundedJson } from "./request-json"
import { z } from "zod"

/** Requests shown per page of a workspace's request list. */
export const TEAM_REQUEST_PAGE_DEFAULT = 20
/** Largest accepted command body: a full proposal with three links and a note fits well inside. */
export const TEAM_REQUEST_BODY_MAX = 16384

export type TeamRequestsQuery = { cursor: string | null; limit: number }
const listQuerySchema = z.object({
    cursor: z.string().min(1).max(4096).optional(),
    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(TEAM_REQUEST_PAGE_MAX)
        .default(TEAM_REQUEST_PAGE_DEFAULT),
})

/** `null` means the query is malformed; an out-of-range limit is rejected, not clamped. */
export function parseTeamRequestsQuery(
    params: URLSearchParams
): TeamRequestsQuery | null {
    const parsed = listQuerySchema.safeParse({
        cursor: params.get("cursor") ?? undefined,
        limit: params.get("limit") ?? undefined,
    })
    return parsed.success
        ? { cursor: parsed.data.cursor ?? null, limit: parsed.data.limit }
        : null
}

export const teamRequestIdSchema = z.string().min(1).max(64)
/** Workspace commands; a submission is validated with the domain schema before Convex sees it. */
export const teamRequestCommandSchema = z.discriminatedUnion("action", [
    z.strictObject({
        action: z.literal("submit"),
        input: teamRequestSubmitSchema,
    }),
    z.strictObject({
        action: z.literal("cancel"),
        requestId: teamRequestIdSchema,
    }),
])
export type TeamRequestCommand = z.infer<typeof teamRequestCommandSchema>

const CONFLICTS = new Set(["idempotency_conflict", "not_pending"])

/** Maps a request or catalogue error to an HTTP status: conflicts 409, missing 404, everything else 400. */
export function teamRequestErrorStatus(error: string): number {
    if (CONFLICTS.has(error)) return 409
    if (error === "not_found") return 404
    return 400
}

/** Turns a Convex command result into a response body and status, passing `existingId` through. */
export function teamRequestCommandResponse(result: unknown): {
    body: unknown
    status: number
} {
    const record =
        result && typeof result === "object"
            ? (result as { error?: unknown; existingId?: unknown })
            : {}
    if (typeof record.error === "string")
        return {
            body: {
                error: record.error,
                ...(typeof record.existingId === "string"
                    ? { existingId: record.existingId }
                    : {}),
            },
            status: teamRequestErrorStatus(record.error),
        }
    return { body: result, status: 200 }
}

export type TeamRequestsDashboardPorts<Access extends TeamDashboardAccess> =
    TeamDashboardGate<Access> & {
        list(access: Access, query: TeamRequestsQuery): Promise<unknown>
        submit(access: Access, input: TeamRequestSubmit): Promise<unknown>
        cancel(access: Access, requestId: string): Promise<unknown>
    }

/**
 * A workspace's team requests: newest-first reads and same-origin submit or
 * cancel commands. Every call is admin-only and consumes the actor's team
 * bucket before Convex is called; a thrown Convex call reads as 503.
 */
export function teamRequestsDashboardHandlers<
    Access extends TeamDashboardAccess,
>(ports: TeamRequestsDashboardPorts<Access>) {
    return {
        async GET(request: Request, serverId: string): Promise<Response> {
            try {
                const admitted = await admitTeamDashboard(ports, serverId)
                if ("denied" in admitted) return admitted.denied
                const query = parseTeamRequestsQuery(
                    new URL(request.url).searchParams
                )
                if (!query)
                    return teamNoStore({ error: "invalid_request" }, 400)
                return teamNoStore(await ports.list(admitted.access, query))
            } catch {
                return teamNoStore({ error: "unavailable" }, 503)
            }
        },
        async POST(request: Request, serverId: string): Promise<Response> {
            if (request.headers.get("origin") !== new URL(request.url).origin)
                return teamNoStore({ error: "forbidden" }, 403)
            try {
                const admitted = await admitTeamDashboard(ports, serverId)
                if ("denied" in admitted) return admitted.denied
                const command = teamRequestCommandSchema.safeParse(
                    await readBoundedJson(request, TEAM_REQUEST_BODY_MAX)
                )
                if (!command.success)
                    return teamNoStore({ error: "invalid_request" }, 400)
                const result = teamRequestCommandResponse(
                    command.data.action === "submit"
                        ? await ports.submit(
                              admitted.access,
                              command.data.input
                          )
                        : await ports.cancel(
                              admitted.access,
                              command.data.requestId
                          )
                )
                return teamNoStore(result.body, result.status)
            } catch {
                return teamNoStore({ error: "unavailable" }, 503)
            }
        },
    }
}
