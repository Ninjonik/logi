import { DefaultRestOptions, type RESTOptions } from "@discordjs/rest"

/** REST retries are unsafe for resource POSTs without Discord idempotency keys. */
export function resourceCreationRequest(
    request: RESTOptions["makeRequest"] = DefaultRestOptions.makeRequest
): RESTOptions["makeRequest"] {
    return async (url, init) => {
        const create =
            init.method?.toUpperCase() === "POST" &&
            /\/(guilds\/[^/]+\/(channels|scheduled-events)|channels\/[^/]+\/threads)$/.test(
                new URL(url).pathname
            )
        if (!create) return request(url, init)
        try {
            const response = await request(url, init)
            if (response.status >= 500 && response.status < 600) {
                // Drain the body before throwing so the connection can be reused.
                await response.arrayBuffer()
                throw new Error(
                    `Discord resource creation uncertain (HTTP ${response.status})`
                )
            }
            return response
        } catch (error) {
            // The SDK recognizes AbortError/ECONNRESET as retryable. Wrap without
            // those signals; the durable journal owns this uncertain outcome.
            throw Object.assign(
                new Error("Discord resource creation uncertain"),
                { deliveryCause: error }
            )
        }
    }
}
