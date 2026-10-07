import { getSiteUrl } from "@/lib/env"

/**
 * Dashboard writes are accepted only from the dashboard's public origin
 * (`SITE_URL`), never from the request URL, which is internal behind a proxy.
 */
export function isDashboardWriteOrigin(request: Request): boolean {
    return request.headers.get("origin") === new URL(getSiteUrl()).origin
}
