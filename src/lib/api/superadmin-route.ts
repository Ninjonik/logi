import type { DashboardActor } from "../../../convex/dashboardActor"

/** Largest JSON body a global-administration write accepts. */
export const SUPERADMIN_JSON_LIMIT = 16384

/** Convex arguments of a global-administration call: the gateway secret and the attested actor. */
export type SuperadminAccess = { secret: string; actor: DashboardActor }

/**
 * Global administration requires a current dashboard actor whose superadmin
 * flag the web gateway attested from operator configuration; Convex checks the
 * same flag and session again inside its transaction.
 */
export function superadminAccess(
    actor: DashboardActor | null,
    secret: string
): SuperadminAccess | null {
    return actor?.superadmin === true ? { secret, actor } : null
}

const CONFLICTS: ReadonlySet<string> = new Set([
    "duplicate_name",
    "revision_conflict",
    "idempotency_conflict",
    "archived",
    "not_archived",
    "not_pending",
])

/** Conflicts are 409, a missing record 404 and every other refusal 400. */
export function superadminErrorStatus(error: string): number {
    if (CONFLICTS.has(error)) return 409
    if (error === "not_found") return 404
    return 400
}

/** Turns a Convex command result into a response body and status, passing `existingId` through. */
export function superadminCommandResponse(result: unknown): {
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
            status: superadminErrorStatus(record.error),
        }
    return { body: result, status: 200 }
}

export function noStore(value: unknown, status = 200): Response {
    return Response.json(value, {
        status,
        headers: { "Cache-Control": "no-store" },
    })
}

/**
 * Writes are accepted only from the dashboard's public origin (`SITE_URL`),
 * never from the request URL, which is internal behind a proxy.
 */
export function isSameOrigin(request: Request, origin: string): boolean {
    return request.headers.get("origin") === origin
}
