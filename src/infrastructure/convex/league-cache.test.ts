import type {
    Prepared,
    CacheState,
} from "../../application/wardogs-league/read-match"
import { parseMatchHtml } from "../wardogs-league/parse-match"
import * as cache from "../../../convex/leagueMatches"
import { test, type TestContext } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
type Row = { _id: string } & Record<string, unknown>
class Database {
    tables: Record<string, Row[]> = {}
    next = 0
    query(table: string) {
        const checks: Array<(r: Row) => boolean> = []
        let sortKey = ""
        const index = {
            eq: (k: string, v: unknown) => {
                checks.push((r) => r[k] === v)
                return index
            },
        }
        const rows = () =>
            (this.tables[table] ?? [])
                .filter((r) => checks.every((c) => c(r)))
                .sort(
                    (a, b) => Number(a[sortKey] ?? 0) - Number(b[sortKey] ?? 0)
                )
        const query = {
            withIndex: (name: string, fn?: (q: typeof index) => unknown) => {
                sortKey = name
                fn?.(index)
                return query
            },
            order: () => query,
            unique: async () => rows()[0] ?? null,
            first: async () => rows()[0] ?? null,
            take: async (n: number) => rows().slice(0, n),
        }
        return query
    }
    async get(id: string) {
        return (
            Object.values(this.tables)
                .flat()
                .find((r) => r._id === id) ?? null
        )
    }
    async insert(table: string, data: Record<string, unknown>) {
        const id = table + this.next++
        ;(this.tables[table] ??= []).push({ _id: id, ...data })
        return id
    }
    async patch(id: string, data: Record<string, unknown>) {
        Object.assign((await this.get(id))!, data)
    }
    async delete(id: string) {
        for (const table of Object.keys(this.tables))
            this.tables[table] = this.tables[table].filter((r) => r._id !== id)
    }
}
function handler<T>(value: unknown) {
    return (
        value as {
            _handler: (
                ctx: unknown,
                args: Record<string, unknown>
            ) => Promise<T>
        }
    )._handler
}
const reserve = handler<Prepared>(cache.reserve),
    finish = handler<CacheState | null>(cache.finish)
test("bounded cache evicts an inactive entry and pruning updates the shared count", async (t) => {
    const { ctx, args, advance } = await setup(t)
    await ctx.db.insert("leagueFetchBudget", {
        key: "public-matches",
        windowAt: Date.now(),
        count: 0,
        blockedUntil: 0,
        cachedEntries: 500,
    })
    const oldId = await ctx.db.insert("leagueMatchCache", {
        matchId: "old",
        nextRefreshAt: 0,
        leaseUntil: 0,
        fence: 1,
        accessedAt: 0,
    })
    const claim = await reserve(ctx, args)
    assert.equal(claim.kind, "claimed")
    assert.equal(await ctx.db.get(oldId), null)
    assert.equal(ctx.db.tables.leagueFetchBudget[0].cachedEntries, 500)
    advance(15 * 86400_000)
    if (claim.kind === "claimed") {
        await handler(cache.prune)(ctx, { cacheId: claim.cacheId })
        assert.equal(await ctx.db.get(claim.cacheId), null)
        assert.equal(ctx.db.tables.leagueFetchBudget[0].cachedEntries, 499)
    }
})
const url = "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
async function setup(t: TestContext) {
    const old = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = "fixture-secret"
    t.after(() => {
        if (old === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = old
    })
    let now = Date.parse("2026-10-02T19:00:00Z")
    t.mock.method(Date, "now", () => now)
    const ctx = {
        db: new Database(),
        scheduler: { runAfter: async () => null },
    }
    const policy = { resources: ["league-matches"], gameIds: ["wardogs"] }
    const keyId = await ctx.db.insert("apiKeys", {
        keyHash: "hash",
        guildId: "guild",
        readAccess: policy,
    })
    const args = {
        secret: "fixture-secret",
        guildId: "guild",
        sourceUrl: url,
        keyHash: "hash",
    }
    const snapshot = {
        ...parseMatchHtml(
            readFileSync(
                new URL(
                    "../wardogs-league/fixtures/scheduled.html",
                    import.meta.url
                ),
                "utf8"
            ),
            url
        ),
        fetchedAt: new Date(now).toISOString(),
    }
    return {
        ctx,
        args,
        keyId,
        policy,
        snapshot,
        advance: (ms: number) => {
            now += ms
        },
    }
}
test("Convex enforces resource, game, guild, revocation and internal authentication", async (t) => {
    const { ctx, args, keyId } = await setup(t)
    await assert.rejects(
        reserve(ctx, { ...args, secret: "wrong" }),
        /Unauthorized/
    )
    for (const patch of [
        { readAccess: undefined },
        { readAccess: { resources: ["events"], gameIds: ["wardogs"] } },
        {
            readAccess: {
                resources: ["league-matches"],
                gameIds: ["hell_let_loose"],
            },
        },
        { guildId: "other" },
    ]) {
        await ctx.db.patch(keyId, patch)
        assert.deepEqual(await reserve(ctx, args), { kind: "denied" })
    }
    assert.equal(ctx.db.tables.leagueMatchCache?.length ?? 0, 0)
})
test("lease coalesces calls, caches five minutes, retains stale data and applies global Retry-After", async (t) => {
    const { ctx, args, snapshot, advance } = await setup(t)
    const first = await reserve(ctx, args)
    assert.equal(first.kind, "claimed")
    if (first.kind !== "claimed") return
    const concurrent = await reserve(ctx, args)
    assert.ok(
        concurrent.kind === "ready" &&
            concurrent.state.error === "refresh_in_progress"
    )
    await finish(ctx, {
        ...args,
        cacheId: first.cacheId,
        fence: first.fence,
        snapshotJson: JSON.stringify(snapshot),
    })
    advance(299_000)
    const hit = await reserve(ctx, args)
    assert.ok(
        hit.kind === "ready" &&
            hit.state.snapshot?.fetchedAt === snapshot.fetchedAt
    )
    advance(1001)
    const next = await reserve(ctx, args)
    assert.equal(next.kind, "claimed")
    if (next.kind !== "claimed") return
    const state = await finish(ctx, {
        ...args,
        cacheId: next.cacheId,
        fence: next.fence,
        error: "rate_limited",
        retryAfterMs: 120000,
    })
    assert.equal(state?.snapshot?.fetchedAt, snapshot.fetchedAt)
    assert.equal(state?.error, "rate_limited")
    const other = await reserve(ctx, {
        ...args,
        sourceUrl: url.replace(/[^/]+$/, "another"),
    })
    assert.ok(other.kind === "ready" && other.state.error === "rate_limited")
    advance(120001)
    assert.equal((await reserve(ctx, args)).kind, "claimed")
})
test("finish rechecks authorization and fences late writers", async (t) => {
    const { ctx, args, keyId, advance, snapshot } = await setup(t)
    const a = await reserve(ctx, args)
    if (a.kind !== "claimed") assert.fail("claim expected")
    advance(26000)
    const b = await reserve(ctx, args)
    assert.equal(b.kind, "claimed")
    assert.equal(
        await finish(ctx, {
            ...args,
            cacheId: a.cacheId,
            fence: a.fence,
            snapshotJson: JSON.stringify(snapshot),
        }),
        null
    )
    await ctx.db.patch(keyId, { revokedAt: "now" })
    assert.deepEqual(await reserve(ctx, args), { kind: "denied" })
    if (b.kind === "claimed")
        assert.equal(
            await finish(ctx, {
                ...args,
                cacheId: b.cacheId,
                fence: b.fence,
                error: "http",
            }),
            null
        )
})
test("global network budget prevents misses across different match IDs", async (t) => {
    const { ctx, args } = await setup(t)
    for (let i = 0; i < 20; i++)
        assert.equal(
            (
                await reserve(ctx, {
                    ...args,
                    sourceUrl: url.replace(/[^/]+$/, `fixture${i}`),
                })
            ).kind,
            "claimed"
        )
    const blocked = await reserve(ctx, {
        ...args,
        sourceUrl: url.replace(/[^/]+$/, "twentyone"),
    })
    assert.ok(
        blocked.kind === "ready" && blocked.state.error === "rate_limited"
    )
})
