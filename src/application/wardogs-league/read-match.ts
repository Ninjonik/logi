import {
    CACHE_MS,
    LeagueError,
    leagueReadSchema,
    losesMatchStructure,
    type LeagueSnapshot,
    type LeagueRead,
    type LeagueErrorCode,
} from "../../domain/wardogs-league/contracts"
import { matchUrl } from "../../domain/wardogs-league/match-url"
export type CacheState = {
    snapshot: LeagueSnapshot | null
    lastAttemptAt: number | null
    nextRefreshAt: number
    error: LeagueErrorCode | null
}
export type Prepared =
    | { kind: "denied" }
    | { kind: "ready"; state: CacheState }
    | {
          kind: "claimed"
          cacheId: string
          fence: number
          previous: LeagueSnapshot | null
      }
export type Served = { kind: "denied" } | { kind: "data"; data: LeagueRead }
export type Ports = {
    now: () => number
    reserve: () => Promise<Prepared>
    fetch: (url: string) => Promise<LeagueSnapshot>
    finish: (
        claim: { cacheId: string; fence: number },
        result:
            | { snapshot: LeagueSnapshot }
            | { error: LeagueErrorCode; retryAfterMs: number }
    ) => Promise<CacheState | null>
}
export async function readLeagueMatch(
    url: string,
    ports: Ports
): Promise<Served> {
    const source = matchUrl(url)
    const prepared = await ports.reserve()
    if (prepared.kind === "denied") return prepared
    let state: CacheState | null
    if (prepared.kind === "ready") state = prepared.state
    else {
        let result: Parameters<Ports["finish"]>[1]
        try {
            const snapshot = await ports.fetch(source.url)
            if (
                snapshot.id !== source.id ||
                (prepared.previous &&
                    losesMatchStructure(prepared.previous, snapshot))
            )
                throw new LeagueError("invalid_html")
            result = { snapshot }
        } catch (error) {
            result = {
                error: error instanceof LeagueError ? error.code : "network",
                retryAfterMs:
                    error instanceof LeagueError
                        ? (error.retryAfterMs ?? 60_000)
                        : 60_000,
            }
        }
        state = await ports.finish(
            { cacheId: prepared.cacheId, fence: prepared.fence },
            result
        )
    }
    if (!state) return { kind: "denied" }
    const age = state.snapshot
        ? Math.max(0, ports.now() - Date.parse(state.snapshot.fetchedAt))
        : null
    return {
        kind: "data",
        data: leagueReadSchema.parse({
            snapshot: state.snapshot,
            stale: age === null || age >= CACHE_MS || state.error !== null,
            ageSeconds: age === null ? null : Math.floor(age / 1000),
            lastAttemptAt:
                state.lastAttemptAt === null
                    ? null
                    : new Date(state.lastAttemptAt).toISOString(),
            nextRefreshAt: new Date(state.nextRefreshAt).toISOString(),
            error: state.error,
        }),
    }
}
