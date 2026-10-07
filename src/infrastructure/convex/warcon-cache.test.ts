import {
    warconLive,
    warconPlayer,
    warconServerId,
    warconTime,
} from "../testing/warcon"
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
test("public panels can read only their enabled guild/source live view, including final authorization", async (t) => {
    const { ctx, input, id, envelope } = await fixture(t)
    const panelId = await ctx.db.insert("discordPublicPanels", {
        guildId: "guild",
        connectionId: id,
        enabled: true,
        kind: "server",
    })
    const { keyHash: _key, ...publicInput } = input
    assert.equal(_key, "hash")
    const args = { ...publicInput, panelId }
    const claim = await handler<Claim>(reads.reserve)(ctx, args)
    assert.equal(claim.kind, "claimed")
    await ctx.db.patch(panelId, { enabled: false })
    assert.equal(
        await handler<boolean>(reads.finish)(ctx, {
            ...args,
            ...claim.claim,
            envelopeJson: JSON.stringify(envelope),
        }),
        false
    )
    await ctx.db.patch(panelId, { enabled: true })
    for (const bad of [
        { ...args, guildId: "other" },
        { ...args, keyHash: "hash" },
        { ...args, queryJson: JSON.stringify({ view: "matches" }) },
    ])
        assert.deepEqual(await handler<unknown>(reads.reserve)(ctx, bad), {
            kind: "denied",
        })
})

test("Naše servery reads the live view of its own servers only (P4-38)", async (t) => {
    const { ctx, input, id } = await fixture(t)
    const { keyHash: _key, ...publicInput } = input
    assert.equal(_key, "hash")
    const combined = await ctx.db.insert("discordPublicPanels", {
        guildId: "guild",
        connectionIds: ["gameDataConnections:other", id],
        enabled: true,
        kind: "servers",
    })
    assert.equal(
        (
            await handler<{ kind: string }>(reads.reserve)(ctx, {
                ...publicInput,
                panelId: combined,
            })
        ).kind,
        "claimed"
    )
    const elsewhere = await ctx.db.insert("discordPublicPanels", {
        guildId: "guild",
        connectionIds: ["gameDataConnections:other"],
        enabled: true,
        kind: "servers",
    })
    const results = await ctx.db.insert("discordPublicPanels", {
        guildId: "guild",
        connectionId: id,
        enabled: true,
        kind: "results",
    })
    for (const panelId of [elsewhere, results])
        assert.deepEqual(
            await handler<unknown>(reads.reserve)(ctx, {
                ...publicInput,
                panelId,
            }),
            { kind: "denied" }
        )
})

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
/** Every write, as `<operation>:<table>`, with a patch's fields. */
function recordWrites(t: TestContext, db: Database) {
    const writes: Array<{ op: string; table: string; fields: string[] }> = []
    const table = (id: string) => id.replace(/\d+$/, "")
    const patch = db.patch.bind(db)
    const insert = db.insert.bind(db)
    const remove = db.delete.bind(db)
    t.mock.method(db, "patch", async (id: string, value: Row) => {
        writes.push({
            op: "patch",
            table: table(id),
            fields: Object.keys(value).sort(),
        })
        return await patch(id, value)
    })
    t.mock.method(db, "insert", async (name: string, value: Row) => {
        writes.push({ op: "insert", table: name, fields: [] })
        return await insert(name, value)
    })
    t.mock.method(db, "delete", async (id: string) => {
        writes.push({ op: "delete", table: table(id), fields: [] })
        return await remove(id)
    })
    return writes
}
const summary = (writes: Array<{ op: string; table: string }>) =>
    writes.map((write) => `${write.op}:${write.table}`)

test("an unchanged Warcon read writes only the small row's times; a changed one writes the payload row once; both serve the latest times", async (t) => {
    const { ctx, input, envelope } = await fixture(t)
    let clock = Date.parse(warconTime)
    t.mock.method(Date, "now", () => clock)
    const first = await handler<Claim>(reads.reserve)(ctx, input)
    assert.equal(
        await handler(reads.finish)(ctx, {
            ...input,
            ...first.claim,
            envelopeJson: JSON.stringify(envelope),
        }),
        true
    )
    const row = () => ctx.db.tables.warconReadCache[0]!
    const payload = () => ctx.db.tables.warconReadPayloads[0]!
    assert.equal(
        row().envelopeJson,
        undefined,
        "the cache row holds no payload"
    )
    const stored = payload().envelopeJson
    const writes = recordWrites(t, ctx.db)
    // The idle server reads the same ten seconds later; only the times moved.
    clock += 11_000
    const later = new Date(clock).toISOString()
    const same = {
        ...envelope,
        fetchedAt: later,
        cacheUntil: new Date(clock + 10_000).toISOString(),
        result: {
            view: "live",
            data: {
                ...envelope.result.data,
                statusAt: later,
                playersAt: later,
                observedAt: later,
            },
        },
    }
    const second = await handler<Claim>(reads.reserve)(ctx, input)
    assert.equal(second.kind, "claimed")
    // The claim: the connection's read budget and the lease, two small rows.
    assert.deepEqual(summary(writes), [
        "patch:warconReadLimits",
        "patch:warconReadCache",
    ])
    writes.length = 0
    assert.equal(
        await handler(reads.finish)(ctx, {
            ...input,
            ...second.claim,
            envelopeJson: JSON.stringify(same),
        }),
        true
    )
    assert.deepEqual(writes, [
        {
            op: "patch",
            table: "warconReadCache",
            fields: [
                "cacheUntil",
                "fetchedAt",
                "leaseUntil",
                "observedAt",
                "playersAt",
                "retainUntil",
                "statusAt",
            ],
        },
    ])
    assert.equal(payload().envelopeJson, stored)
    const cached = await handler<{
        kind: string
        envelope: typeof envelope
    }>(reads.reserve)(ctx, input)
    assert.equal(cached.kind, "cached")
    assert.equal(cached.envelope.fetchedAt, later)
    assert.equal(cached.envelope.cacheUntil, same.cacheUntil)
    assert.equal(cached.envelope.result.data.statusAt, later)
    assert.equal(cached.envelope.result.data.playersAt, later)
    assert.equal(cached.envelope.result.data.observedAt, later)
    assert.deepEqual(
        cached.envelope.result.data.players,
        envelope.result.data.players
    )
    // A player joined: the payload row is written again.
    clock += 11_000
    const latest = new Date(clock).toISOString()
    const changed = {
        ...same,
        fetchedAt: latest,
        cacheUntil: new Date(clock + 10_000).toISOString(),
        result: {
            view: "live",
            data: {
                ...same.result.data,
                statusAt: latest,
                playersAt: latest,
                observedAt: latest,
                players: [
                    ...same.result.data.players,
                    { ...warconPlayer, steamId: "76561198000000002" },
                ],
            },
        },
    }
    const third = await handler<Claim>(reads.reserve)(ctx, input)
    assert.equal(third.kind, "claimed")
    writes.length = 0
    await handler(reads.finish)(ctx, {
        ...input,
        ...third.claim,
        envelopeJson: JSON.stringify(changed),
    })
    assert.deepEqual(summary(writes), [
        "patch:warconReadPayloads",
        "patch:warconReadCache",
    ])
    assert.notEqual(payload().envelopeJson, stored)
    const served = await handler<{
        kind: string
        envelope: typeof envelope
    }>(reads.reserve)(ctx, input)
    assert.equal(served.kind, "cached")
    assert.equal(served.envelope.fetchedAt, latest)
    assert.equal(served.envelope.result.data.players.length, 2)
})
test("the Warcon read budget and a provider 429 live in their own small row, never on the connection", async (t) => {
    const { ctx, input, id } = await fixture(t)
    let clock = Date.parse(warconTime)
    t.mock.method(Date, "now", () => clock)
    const writes = recordWrites(t, ctx.db)
    for (let page = 1; page <= 30; page++)
        assert.equal(
            (
                await handler<{ kind: string }>(reads.reserve)(ctx, {
                    ...input,
                    queryJson: JSON.stringify({ view: "matches", page }),
                })
            ).kind,
            "claimed"
        )
    const limited = await handler<{ kind: string; retryAfterMs: number }>(
        reads.reserve
    )(ctx, { ...input, queryJson: JSON.stringify({ view: "catalog" }) })
    assert.deepEqual(limited, { kind: "busy", retryAfterMs: 60_000 })
    assert.equal(ctx.db.tables.warconReadLimits.length, 1)
    assert.equal(ctx.db.tables.warconReadLimits[0]!.count, 30)
    assert.ok(!writes.some((write) => write.table === "gameDataConnections"))
    // A new minute; a provider 429 blocks every view of the connection.
    clock += 60_000
    const claim = await handler<Claim>(reads.reserve)(ctx, input)
    await handler(reads.finish)(ctx, {
        ...input,
        ...claim.claim,
        errorCategory: "rate_limited",
        retryAfterMs: 90_000,
    })
    assert.equal(
        ctx.db.tables.warconReadLimits[0]!.blockedUntil,
        clock + 90_000
    )
    assert.deepEqual(
        await handler(reads.reserve)(ctx, {
            ...input,
            queryJson: JSON.stringify({ view: "catalog" }),
        }),
        { kind: "busy", retryAfterMs: 90_000 }
    )
    assert.ok(!writes.some((write) => write.table === "gameDataConnections"))
    // A block stored on the connection before the move is still honoured.
    clock += 90_000
    await ctx.db.patch(id, { warconReadBlockedUntil: clock + 5_000 })
    assert.deepEqual(
        await handler(reads.reserve)(ctx, {
            ...input,
            queryJson: JSON.stringify({ view: "catalog" }),
        }),
        { kind: "busy", retryAfterMs: 5_000 }
    )
})
test("a Warcon cache row from before the time fields serves the payload's own times", async (t) => {
    const { ctx, input, id, envelope } = await fixture(t)
    await ctx.db.insert("warconReadCache", {
        connectionId: id,
        queryJson: JSON.stringify({ view: "live" }),
        generation: 1,
        fence: 2,
        leaseUntil: 0,
        cacheUntil: Date.now() + 5_000,
        retryUntil: 0,
        retainUntil: Date.now() + 3_600_000,
        envelopeJson: JSON.stringify(envelope),
    })
    const cached = await handler<{ kind: string; envelope: unknown }>(
        reads.reserve
    )(ctx, input)
    assert.equal(cached.kind, "cached")
    assert.deepEqual(cached.envelope, envelope)
})
