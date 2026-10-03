import { warconLive, warconServerId, warconTime } from "../testing/warcon"
import { seedDashboardActor } from "./testing/dashboard-actor"
import * as history from "../../../convex/gameDataHistory"
import * as reads from "../../../convex/warconReads"
import * as gameData from "../../../convex/gameData"
import { test, type TestContext } from "node:test"
import assert from "node:assert/strict"
type Row = { _id: string } & Record<string, unknown>
class Database {
    tables: Record<string, Row[]> = {}
    next = 0
    query(table: string) {
        const checks: Array<(r: Row) => boolean> = []
        const index = {
            eq: (k: string, v: unknown) => {
                checks.push((r) => r[k] === v)
                return index
            },
            gte: (k: string, v: number) => {
                checks.push((r) => Number(r[k]) >= v)
                return index
            },
            lte: (k: string, v: number) => {
                checks.push((r) => Number(r[k]) <= v)
                return index
            },
        }
        const rows = () =>
            (this.tables[table] ?? []).filter((r) =>
                checks.every((check) => check(r))
            )
        const query = {
            withIndex: (_name: string, fn: (q: typeof index) => unknown) => {
                fn(index)
                return query
            },
            unique: async () => rows()[0] ?? null,
            first: async () => rows()[0] ?? null,
            take: async (n: number) => rows().slice(0, n),
            collect: async () => rows(),
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
    normalizeId(table: string, id: string) {
        return this.tables[table]?.some((r) => r._id === id) ? id : null
    }
    async insert(table: string, value: Record<string, unknown>) {
        const id = table + this.next++
        ;(this.tables[table] ??= []).push({ _id: id, ...value })
        return id
    }
    async patch(id: string, value: Record<string, unknown>) {
        Object.assign((await this.get(id))!, value)
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
const source = {
    ref: "wd",
    guildId: "guild",
    gameId: "wardogs",
    provider: "wardogs_warcon",
    providerServerId: warconServerId,
    origin: "https://warcon.example",
    secretRef: "LOGI_GAME_DATA_WD_TOKEN",
    allowedAddresses: [],
}
async function fixture(t: TestContext) {
    const previous = {
        catalog: process.env.LOGI_GAME_DATA_SOURCES,
        secret: process.env.INTERNAL_AUTH_SECRET,
    }
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([source])
    process.env.INTERNAL_AUTH_SECRET = "synthetic-secret"
    t.after(() => {
        for (const [key, value] of [
            ["LOGI_GAME_DATA_SOURCES", previous.catalog],
            ["INTERNAL_AUTH_SECRET", previous.secret],
        ]) {
            if (value === undefined) delete process.env[key!]
            else process.env[key!] = value
        }
    })
    t.mock.method(Date, "now", () => Date.parse(warconTime))
    const ctx = {
        db: new Database(),
        scheduler: { runAfter: async () => null },
    }
    const id = await handler<string>(gameData.configure)(ctx, {
        secret: "synthetic-secret",
        guildId: "guild",
        sourceRef: "wd",
        enabled: true,
    })
    const keyId = await ctx.db.insert("apiKeys", {
        keyHash: "hash",
        guildId: "guild",
        readAccess: { resources: ["warcon-data"], gameIds: ["wardogs"] },
    })
    const input = {
        secret: "synthetic-secret",
        guildId: "guild",
        connectionId: id,
        keyHash: "hash",
        queryJson: JSON.stringify({ view: "live" }),
    }
    const envelope = {
        connectionId: id,
        gameId: "wardogs",
        provider: "wardogs_warcon",
        fetchedAt: warconTime,
        cacheUntil: "2026-10-02T12:00:10.000Z",
        result: {
            view: "live",
            data: {
                ...warconLive(),
                freshness: "fresh",
                playersFreshness: "fresh",
            },
        },
    }
    return { ctx, input, id, keyId, envelope }
}
type Claim = {
    kind: "claimed"
    claim: { cacheId: string; generation: number; fence: number }
}

test("dashboard Warcon reads recheck current actor rights and session before returning provider data", async (t) => {
    for (const mode of ["rights", "session", "global"]) {
        const { ctx, input, envelope } = await fixture(t)
        const actor = seedDashboardActor(ctx.db, "guild")
        const args = { ...input, keyHash: undefined, actor }
        const pending = await handler<Claim>(reads.reserve)(ctx, args)
        assert.equal(pending.kind, "claimed")
        if (mode === "rights")
            await ctx.db.patch("access:admin", {
                isAdmin: false,
                hasDashboardAccess: false,
            })
        if (mode === "session")
            await ctx.db.patch("sessions:admin", { revokedAt: Date.now() })
        if (mode === "global")
            await ctx.db.patch(actor.userRecordId, { sessionVersion: 1 })
        assert.equal(
            await handler(reads.finish)(ctx, {
                ...args,
                ...pending.claim,
                envelopeJson: JSON.stringify(envelope),
            }),
            false
        )
        assert.deepEqual(await handler(reads.reserve)(ctx, args), {
            kind: "denied",
        })
    }
})

test("Warcon reads without either a scoped key or a dashboard actor are denied", async (t) => {
    const { ctx, input } = await fixture(t)
    assert.deepEqual(
        await handler(reads.reserve)(ctx, { ...input, keyHash: undefined }),
        { kind: "denied" }
    )
    assert.equal(ctx.db.tables.warconReadCache?.length ?? 0, 0)
})
test("Warcon cache enforces tenant/game/resource/legacy/revocation independently of Next", async (t) => {
    const { ctx, input, keyId } = await fixture(t)
    await assert.rejects(
        () => handler(reads.reserve)(ctx, { ...input, secret: "wrong" }),
        /Unauthorized/
    )
    for (const patch of [
        { guildId: "another" },
        { guildId: "guild", readAccess: undefined },
        {
            readAccess: {
                resources: ["server-snapshots"],
                gameIds: ["wardogs"],
            },
        },
        {
            readAccess: {
                resources: ["warcon-data"],
                gameIds: ["hell_let_loose"],
            },
        },
        {
            readAccess: { resources: ["warcon-data"], gameIds: ["wardogs"] },
            revokedAt: warconTime,
        },
    ]) {
        await ctx.db.patch(keyId, patch)
        assert.deepEqual(await handler(reads.reserve)(ctx, input), {
            kind: "denied",
        })
    }
    assert.equal(ctx.db.tables.warconReadCache?.length ?? 0, 0)
})
test("a shared lease prevents duplicate fetches, cached results recheck authorization", async (t) => {
    const { ctx, input, envelope, keyId } = await fixture(t)
    const first = await handler<Claim>(reads.reserve)(ctx, input)
    assert.equal(first.kind, "claimed")
    assert.equal(
        (await handler<{ kind: string }>(reads.reserve)(ctx, input)).kind,
        "busy"
    )
    assert.equal(
        await handler(reads.finish)(ctx, {
            ...input,
            ...first.claim,
            envelopeJson: JSON.stringify(envelope),
        }),
        true
    )
    assert.equal(
        (await handler<{ kind: string }>(reads.reserve)(ctx, input)).kind,
        "cached"
    )
    await ctx.db.patch(keyId, { revokedAt: warconTime })
    assert.deepEqual(await handler(reads.reserve)(ctx, input), {
        kind: "denied",
    })
})
test("disable, source edit, expired lease and key revocation fence an in-flight response", async (t) => {
    for (const change of ["disable", "origin", "expiry", "key"]) {
        const { ctx, input, envelope, id, keyId } = await fixture(t)
        const first = await handler<Claim>(reads.reserve)(ctx, input)
        if (change === "disable")
            await ctx.db.patch(id, { enabled: false, generation: 2 })
        if (change === "origin")
            process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([
                { ...source, origin: "https://new.example" },
            ])
        if (change === "expiry")
            await ctx.db.patch(first.claim.cacheId, { leaseUntil: 0 })
        if (change === "key")
            await ctx.db.patch(keyId, { revokedAt: warconTime })
        assert.equal(
            await handler(reads.finish)(ctx, {
                ...input,
                ...first.claim,
                envelopeJson: JSON.stringify(envelope),
            }),
            false
        )
    }
})
test("provider 429 blocks new views as well as repeated reads", async (t) => {
    const { ctx, input } = await fixture(t)
    const first = await handler<Claim>(reads.reserve)(ctx, input)
    await handler(reads.finish)(ctx, {
        ...input,
        ...first.claim,
        errorCategory: "rate_limited",
        retryAfterMs: 90_000,
    })
    assert.deepEqual(
        await handler(reads.reserve)(ctx, {
            ...input,
            queryJson: JSON.stringify({ view: "catalog" }),
        }),
        { kind: "busy", retryAfterMs: 90_000 }
    )
})

test("a malformed optional view backs off independently from a healthy live scoreboard", async (t) => {
    const { ctx, input } = await fixture(t)
    const catalog = { ...input, queryJson: JSON.stringify({ view: "catalog" }) }
    const first = await handler<Claim>(reads.reserve)(ctx, catalog)
    await handler(reads.finish)(ctx, {
        ...catalog,
        ...first.claim,
        errorCategory: "invalid_response",
        retryAfterMs: 30_000,
    })
    assert.equal(
        (await handler<{ kind: string }>(reads.reserve)(ctx, catalog)).kind,
        "busy"
    )
    assert.equal(
        (await handler<{ kind: string }>(reads.reserve)(ctx, input)).kind,
        "claimed"
    )
})
test("Warcon configuration schedules and stores history under the Wardogs game", async (t) => {
    const { ctx, id } = await fixture(t)
    const claim = await handler<{
        runId: string
        generation: number
        fence: number
        connection: { provider: string }
    }>(history.claimNext)(ctx, {})
    assert.equal(claim.connection.provider, "wardogs_warcon")
    await handler(history.commit)(ctx, {
        runId: claim.runId,
        generation: claim.generation,
        fence: claim.fence,
        result: {
            session: {
                externalId: "7",
                startedAt: warconTime,
                endedAt: warconTime,
                complete: true,
                map: "Bakurani",
                participants: [],
                players: [],
                sourceDigest: "a".repeat(64),
            },
            progress: { page: 1, pendingIds: [], nextPage: null },
            completed: true,
        },
    })
    assert.equal(ctx.db.tables.gameSessions[0].gameId, "wardogs")
    assert.equal(ctx.db.tables.gameSessions[0].connectionId, id)
})
test("cache cardinality and retention stay bounded even across many query variants", async (t) => {
    const { ctx, input } = await fixture(t)
    let clock = Date.parse(warconTime)
    t.mock.method(Date, "now", () => clock)
    for (let page = 1; page <= 66; page++) {
        const claim = await handler<Claim>(reads.reserve)(ctx, {
            ...input,
            queryJson: JSON.stringify({ view: "matches", page }),
        })
        assert.equal(claim.kind, "claimed")
        clock += 40_000
    }
    assert.equal(ctx.db.tables.warconReadCache.length, 64)
    const cacheId = ctx.db.tables.warconReadCache[0]._id
    clock += 3_600_000
    await handler(reads.prune)(ctx, { cacheId })
    assert.equal(ctx.db.tables.warconReadCache.length, 63)
})
