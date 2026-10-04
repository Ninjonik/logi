import type { StatsRequest } from "../../../src/application/game-data/read-player-stats"
import { buildHistoryReport } from "../../../src/application/game-data/history-report"
import { statsFrom } from "../../../src/domain/player-stats/player-stats"
import { historyPageSchema } from "../../../src/domain/game-data/history"
import type { StatsPorts } from "./stats"
import { z } from "zod"

export type StatsScope = {
    guildId: string
    requesterId: string
    observedAt: number
}
export type StatsRuntimeDependencies = {
    now?: () => number
    member: (guildId: string, userId: string) => Promise<boolean>
    account: (scope: StatsScope, targetId: string) => Promise<unknown>
    history: (
        scope: StatsScope,
        cursor: string | null,
        revision: string | undefined,
        filters: { sourceId?: string; from?: string; until: string },
        steamId?: string
    ) => Promise<unknown>
    link: (
        scope: StatsScope,
        steamId: string,
        name: string,
        expected: string[]
    ) => Promise<unknown>
    hll: StatsPorts["hll"]
    artwork: StatsPorts["artwork"]
    send: StatsPorts["share"]
    settings: StatsPorts["settings"]
}
async function bounded<T>(operation: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            operation,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new Error("stats_timeout")), ms)
            }),
        ])
    } finally {
        if (timer) clearTimeout(timer)
    }
}
/** Runtime cache never substitutes for a current Discord membership check. */
export function createStatsRuntimePorts(
    d: StatsRuntimeDependencies
): StatsPorts {
    const now = d.now ?? Date.now,
        proofs = new Map<string, number>()
    type Snapshot = Awaited<ReturnType<StatsPorts["history"]>>
    const cache = new Map<
            string,
            { expires: number; weight: number; value: Snapshot }
        >(),
        pending = new Map<string, Promise<Snapshot>>()
    const key = (r: StatsRequest) =>
        `${r.guildId}:${r.requesterId}:${r.targetId}`
    async function authorize(r: StatsRequest) {
        const started = now()
        const ids = new Set([
            r.requesterId,
            ...(r.playerId ? [] : [r.targetId]),
        ])
        const valid = await bounded(
            Promise.all([...ids].map((id) => d.member(r.guildId, id))),
            7000
        )
            .then((values) => values.every(Boolean))
            .catch(() => false)
        if (valid && now() - started < 5000) {
            proofs.set(key(r), started)
            while (proofs.size > 500) proofs.delete(proofs.keys().next().value!)
            return true
        }
        proofs.delete(key(r))
        return false
    }
    async function scope(r: StatsRequest): Promise<StatsScope> {
        if (now() - (proofs.get(key(r)) ?? 0) >= 5000 && !(await authorize(r)))
            throw new Error("forbidden")
        return {
            guildId: r.guildId,
            requesterId: r.requesterId,
            observedAt: proofs.get(key(r))!,
        }
    }
    return {
        now,
        authorize,
        hll: d.hll,
        artwork: d.artwork,
        settings: d.settings,
        async account(r) {
            return z
                .object({
                    steamIds: z.array(z.string()),
                    name: z.string().nullable(),
                })
                .parse(
                    await bounded(d.account(await scope(r), r.targetId), 7000)
                )
        },
        async link(r, steamId, name, expected) {
            if (
                r.playerId ||
                r.targetId !== r.requesterId ||
                !(await authorize(r))
            )
                throw new Error("forbidden")
            try {
                await bounded(
                    d.link(await scope(r), steamId, name, expected),
                    7000
                )
            } catch (e) {
                // Convex wraps server errors; expose only known, non-sensitive codes.
                const message = e instanceof Error ? e.message : ""
                for (const code of [
                    "invalid_steam",
                    "already_linked",
                    "link_changed",
                ])
                    if (new RegExp(`\\b${code}\\b`).test(message))
                        throw new Error(code)
                throw new Error("link_failed")
            }
        },
        async share(r, channel, payload) {
            if (!(await authorize(r))) throw new Error("forbidden")
            await d.send(r, channel, payload)
        },
        async history(r, steamId) {
            await scope(r)
            const cacheKey = JSON.stringify([
                    r.guildId,
                    r.period,
                    r.sourceId ?? null,
                    steamId ?? null,
                ]),
                cached = cache.get(cacheKey)
            if (cached && cached.expires > now()) return cached.value
            const running = pending.get(cacheKey)
            if (running) return running
            if (pending.size >= 4) throw new Error("stats_busy")
            const work = async () => {
                const deadline = Date.now() + 25_000,
                    until = new Date(now()).toISOString(),
                    filters = {
                        sourceId: r.sourceId,
                        from: statsFrom(r.period, now()),
                        until,
                    }
                try {
                    for (let attempt = 0; attempt < 2; attempt++) {
                        let revision: string | undefined
                        let weight = 0
                        try {
                            const report = await buildHistoryReport(
                                async (cursor) => {
                                    if (Date.now() >= deadline)
                                        throw new Error("stats_timeout")
                                    const evidence = await scope(r)
                                    const raw = await bounded(
                                        d.history(
                                            evidence,
                                            cursor,
                                            revision,
                                            filters,
                                            steamId
                                        ),
                                        Math.max(
                                            1,
                                            Math.min(
                                                7000,
                                                deadline - Date.now()
                                            )
                                        )
                                    )
                                    if (
                                        z
                                            .object({
                                                resetRequired: z.literal(true),
                                            })
                                            .safeParse(raw).success
                                    )
                                        throw new Error(
                                            "stats_revision_changed"
                                        )
                                    const page = historyPageSchema.parse(raw)
                                    weight += page.items.reduce(
                                        (total, row) =>
                                            total +
                                            1 +
                                            row.session.players.length,
                                        0
                                    )
                                    if (weight > 25_000)
                                        throw new Error("stats_history_budget")
                                    revision ??= page.revision
                                    return page
                                },
                                { maxPages: 200, minMinutes: 0 }
                            )
                            const value = {
                                records: report.records,
                                lastCollectedAt: report.lastCollectedAt,
                            }
                            cache.set(cacheKey, {
                                value,
                                weight,
                                expires: now() + 60_000,
                            })
                            while (
                                cache.size > 100 ||
                                [...cache.values()].reduce(
                                    (sum, item) => sum + item.weight,
                                    0
                                ) > 50_000
                            )
                                cache.delete(cache.keys().next().value!)
                            return value
                        } catch (e) {
                            if (
                                attempt === 0 &&
                                e instanceof Error &&
                                e.message === "stats_revision_changed"
                            )
                                continue
                            throw e
                        }
                    }
                    throw new Error("stats_revision_changed")
                } finally {
                    pending.delete(cacheKey)
                }
            }
            const promise = work()
            pending.set(cacheKey, promise)
            return promise
        },
    }
}
