import {
    TEAM_REQUEST_PAGE_MAX,
    teamRequestDecisionSchema,
    teamRequestStatusSchema,
    type TeamRequestStatus,
} from "@/domain/teams/team-request"
import {
    isSameOrigin,
    noStore,
    superadminCommandResponse,
    SUPERADMIN_JSON_LIMIT,
} from "./superadmin-route"
import { readBoundedJson } from "./request-json"
import { z } from "zod"

export const TEAM_REQUEST_QUEUE_DEFAULT = 20
const requestIdSchema = z.string().min(1).max(64)

/** A moderation read: one request by ID, or a page of the queue for one status. */
export type TeamRequestQueueQuery =
    | { kind: "get"; requestId: string }
    | {
          kind: "queue"
          status: TeamRequestStatus
          cursor: string | null
          limit: number
      }
export type TeamRequestQueuePageQuery = Extract<
    TeamRequestQueueQuery,
    { kind: "queue" }
>

const queueQuerySchema = z.object({
    status: teamRequestStatusSchema.default("pending"),
    cursor: z.string().min(1).max(4096).optional(),
    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(TEAM_REQUEST_PAGE_MAX)
        .default(TEAM_REQUEST_QUEUE_DEFAULT),
})

/** `null` means the query is malformed; an unknown status or an out-of-range limit is rejected. */
export function parseTeamRequestQueueQuery(
    params: URLSearchParams
): TeamRequestQueueQuery | null {
    const requestId = params.get("requestId")
    if (requestId !== null) {
        const parsed = requestIdSchema.safeParse(requestId)
        return parsed.success ? { kind: "get", requestId: parsed.data } : null
    }
    const parsed = queueQuerySchema.safeParse({
        status: params.get("status") ?? undefined,
        cursor: params.get("cursor") ?? undefined,
        limit: params.get("limit") ?? undefined,
    })
    if (!parsed.success) return null
    return {
        kind: "queue",
        status: parsed.data.status,
        cursor: parsed.data.cursor ?? null,
        limit: parsed.data.limit,
    }
}

/** One decision on one request; the decision is validated with the domain schema. */
export const teamRequestDecideBodySchema = z.strictObject({
    requestId: requestIdSchema,
    decision: teamRequestDecisionSchema,
})
export type TeamRequestDecideBody = z.infer<typeof teamRequestDecideBodySchema>

export type SuperadminTeamRequestsPorts<Access> = {
    /** The attested global administrator, or null to deny the request. */
    access(): Promise<Access | null>
    get(access: Access, requestId: string): Promise<unknown>
    queue(access: Access, query: TeamRequestQueuePageQuery): Promise<unknown>
    decide(access: Access, body: TeamRequestDecideBody): Promise<unknown>
}

/**
 * The global moderation queue for team requests (superadmins only). Requests
 * are an internal workflow and deliberately have no `/api/v1` counterpart.
 */
export function superadminTeamRequestsHandlers<Access>(
    ports: SuperadminTeamRequestsPorts<Access>
) {
    return {
        /** `?requestId=` reads one request as `{ request }`; otherwise `?status=` pages the queue. */
        async GET(request: Request): Promise<Response> {
            try {
                const access = await ports.access()
                if (!access) return noStore({ error: "forbidden" }, 403)
                const query = parseTeamRequestQueueQuery(
                    new URL(request.url).searchParams
                )
                if (!query) return noStore({ error: "invalid_query" }, 400)
                if (query.kind === "get") {
                    const found = await ports.get(access, query.requestId)
                    return found
                        ? noStore({ request: found })
                        : noStore({ error: "not_found" }, 404)
                }
                return noStore(await ports.queue(access, query))
            } catch {
                return noStore({ error: "unavailable" }, 503)
            }
        },
        async POST(request: Request): Promise<Response> {
            if (!isSameOrigin(request))
                return noStore({ error: "forbidden" }, 403)
            try {
                const access = await ports.access()
                if (!access) return noStore({ error: "forbidden" }, 403)
                const body = teamRequestDecideBodySchema.safeParse(
                    await readBoundedJson(request, SUPERADMIN_JSON_LIMIT)
                )
                if (!body.success)
                    return noStore({ error: "invalid_decision" }, 400)
                const result = superadminCommandResponse(
                    await ports.decide(access, body.data)
                )
                return noStore(result.body, result.status)
            } catch {
                return noStore({ error: "unavailable" }, 503)
            }
        },
    }
}
