/**
 * "Hrál jsi u nás?" (L4-49..51, L4-B08): finds a person among the players
 * the clan's stats servers have seen, by in-game name or ID. The servers are
 * the CRCON player-history connections of Nastavení → Příkazy; their names
 * come from Herní servery when an address matches one there.
 */

import {
    detectPlatformFromStatsId,
    extractPlayerSearchResults,
    type PlayerSearchResult,
} from "./player-search"

/** A stats server: the CRCON player-history address, its key and its name in Logi. */
export type StatsServer = { url: string; token: string; name?: string }

/** A player found on one of the servers. */
export type StatsSearchHit = PlayerSearchResult & {
    platform: "steam" | "epic" | "xbox" | "playstation" | "other"
    server?: string
}

const usable = (server: { url?: string; token?: string }) =>
    Boolean(server.url?.trim() && server.token?.trim())

function originOf(url: string) {
    try {
        return new URL(url.trim()).origin
    } catch {
        return undefined
    }
}

/**
 * The clan's stats servers with their names: a server whose address has the
 * origin of a game server in Logi is called by that game server's name.
 */
export function clanStatsServers(
    servers: ReadonlyArray<{ url?: string; token?: string }> | undefined,
    names: ReadonlyArray<{ origin: string; name: string }> = []
): StatsServer[] {
    const byOrigin = new Map(
        names
            .map(
                (entry) => [originOf(entry.origin), entry.name.trim()] as const
            )
            .filter(
                (entry): entry is readonly [string, string] =>
                    Boolean(entry[0]) && Boolean(entry[1])
            )
    )
    const seen = new Set<string>()
    const result: StatsServer[] = []
    for (const server of servers ?? []) {
        if (!usable(server)) continue
        const url = server.url!.trim()
        if (seen.has(url)) continue
        seen.add(url)
        const name = byOrigin.get(originOf(url) ?? "")
        result.push({
            url,
            token: server.token!.trim(),
            ...(name ? { name } : {}),
        })
    }
    return result
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>

/**
 * Searches every server at once (each bounded to `timeoutMs`) and merges the
 * hits by player ID, the most recent sighting first. "unavailable" when no
 * server answered, so the person is not told they were not found.
 */
export async function searchStatsServers(
    servers: readonly StatsServer[],
    query: string,
    deps: { fetch?: Fetch; timeoutMs?: number } = {}
): Promise<StatsSearchHit[] | "unavailable"> {
    const trimmed = query.trim()
    if (!trimmed || !servers.length) return []
    const doFetch = deps.fetch ?? fetch
    const settled = await Promise.allSettled(
        servers.map(async (server) => {
            const response = await doFetch(server.url, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    authorization: /^bearer\s/i.test(server.token)
                        ? server.token
                        : `Bearer ${server.token}`,
                },
                body: JSON.stringify({
                    page: 1,
                    page_size: 50,
                    flags: [],
                    blacklisted: false,
                    exact_name_match: false,
                    ignore_accent: true,
                    is_watched: false,
                    player_name: trimmed,
                    country: "",
                }),
                signal: AbortSignal.timeout(deps.timeoutMs ?? 5_000),
            })
            if (!response.ok)
                throw new Error(`Stats search failed with ${response.status}`)
            return extractPlayerSearchResults(await response.json()).map(
                (hit): StatsSearchHit => ({
                    ...hit,
                    platform: detectPlatformFromStatsId(hit.playerId),
                    ...(server.name ? { server: server.name } : {}),
                })
            )
        })
    )
    if (settled.every((entry) => entry.status === "rejected"))
        return "unavailable"
    const merged = new Map<string, StatsSearchHit>()
    for (const entry of settled) {
        if (entry.status !== "fulfilled") continue
        for (const hit of entry.value) {
            const known = merged.get(hit.playerId)
            if (!known || (hit.lastSeenAt ?? 0) > (known.lastSeenAt ?? 0))
                merged.set(hit.playerId, hit)
        }
    }
    return [...merged.values()]
        .sort((left, right) => (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0))
        .slice(0, 25)
}
