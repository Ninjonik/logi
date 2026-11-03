import type { CacheRevalidationPayload } from "../../src/lib/gateways/cache-revalidation"
import { deliverCacheInvalidation } from "./cache-delivery"
import { logError, logWarn } from "./log"
import { env } from "./environment"

export async function revalidateAppData(payload: CacheRevalidationPayload) {
    return deliverCacheInvalidation({
        send: () =>
            fetch(new URL("/api/cache/revalidate", env.appSiteUrl), {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ secret: env.internalSecret, payload }),
                signal: AbortSignal.timeout(5000),
            }),
        wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        report: (final, attempt, status) => {
            const log = final ? logError : logWarn
            log(
                "cache-revalidation",
                final
                    ? "Dashboard cache refresh failed after committed write"
                    : "Retrying dashboard cache refresh",
                {
                    type: payload.type,
                    serverId: payload.serverId,
                    attempt,
                    status,
                }
            )
        },
    })
}
