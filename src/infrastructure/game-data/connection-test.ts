import {
    ProviderError,
    type DataSource,
    type ProviderHttp,
} from "../../domain/game-data/contracts"
import type { ConnectionTestOutcome } from "../../domain/game-data/credentials"
import { wardogsDirectoryProvider } from "./wardogs-public-directory"
import { crconResult } from "./hll-crcon"
import { z } from "zod"

export type ConnectionTestResult = {
    outcome: ConnectionTestOutcome
    retryAfterMs?: number
}

/**
 * One read-only request that proves both the target server and, when a key is
 * sent, that the key is accepted for that server. Uses the collector's
 * transport, so the same HTTPS, address, redirect, path, time and size rules
 * apply. Only a category is returned, never a provider message or body.
 */
export async function testProviderConnection(
    source: DataSource,
    http: ProviderHttp,
    input: { keyed: boolean; now: () => number }
): Promise<ConnectionTestResult> {
    try {
        if (source.provider === "wardogs_warcon") {
            // The panel lists exactly the servers this key may read.
            const scope = z
                .object({
                    ok: z.literal(true),
                    servers: z.array(z.object({ id: z.string() })).max(1000),
                })
                .safeParse((await http.get("/api/servers")).body)
            if (!scope.success) return { outcome: "invalid_response" }
            return scope.data.servers.some(
                (server) => server.id === source.providerServerId
            )
                ? { outcome: "ok" }
                : { outcome: "server_mismatch" }
        }
        if (source.provider === "hll_crcon") {
            if (!input.keyed) {
                const info = z
                    .object({ name: z.object({ name: z.string().min(1) }) })
                    .safeParse(
                        crconResult(
                            (await http.get("/api/get_public_info")).body
                        )
                    )
                return { outcome: info.success ? "ok" : "invalid_response" }
            }
            // Authenticated and read-only; reports the CRCON server number.
            const connection = z
                .object({ server_number: z.number().int().nonnegative() })
                .safeParse(
                    crconResult(
                        (await http.get("/api/get_connection_info")).body
                    )
                )
            if (!connection.success) return { outcome: "invalid_response" }
            return String(connection.data.server_number) ===
                source.providerServerId
                ? { outcome: "ok" }
                : { outcome: "server_mismatch" }
        }
        if (source.provider === "wardogs_rcon") {
            const identity = z
                .object({ serverId: z.string() })
                .safeParse((await http.get("/v1/server-id")).body)
            if (!identity.success) return { outcome: "invalid_response" }
            return identity.data.serverId === source.providerServerId
                ? { outcome: "ok" }
                : { outcome: "server_mismatch" }
        }
        await wardogsDirectoryProvider.readSnapshot(source, http, input.now)
        return { outcome: "ok" }
    } catch (error) {
        if (!(error instanceof ProviderError)) return { outcome: "network" }
        if (error.category === "not_listed")
            return { outcome: "server_mismatch" }
        return error.category === "rate_limited"
            ? { outcome: "rate_limited", retryAfterMs: error.retryAfterMs }
            : { outcome: error.category }
    }
}
