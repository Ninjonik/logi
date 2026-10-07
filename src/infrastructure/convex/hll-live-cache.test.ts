import { hllLiveFreshness } from "../../domain/game-data/hll-live-payload"
import { hllLiveFixture, hllLiveTime } from "../testing/hll-live"
import { sourceSchema } from "../../domain/game-data/contracts"
import { invoke, testContext } from "./testing/database"
import * as reads from "../../../convex/hllLiveReads"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

function fixture(t: TestContext) {
    const source = sourceSchema.parse({
        ref: "hll",
        guildId: "guild",
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        providerServerId: "1",
        origin: "https://crcon.example",
        secretRef: null,
    })
    const previous = process.env.LOGI_GAME_DATA_SOURCES
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([source])
    t.after(() => {
        if (previous === undefined) delete process.env.LOGI_GAME_DATA_SOURCES
        else process.env.LOGI_GAME_DATA_SOURCES = previous
    })
    let clock = Date.parse(hllLiveTime)
    t.mock.method(Date, "now", () => clock)
    const ctx = testContext()
    ctx.db.seed("gameDataConnections", {
        _id: "gameDataConnections:one",
        guildId: "guild",
        sourceRef: "hll",
        sourceFingerprint: JSON.stringify(source),
        generation: 1,
        enabled: true,
        provider: "hll_crcon",
        gameId: "hell_let_loose",
    })
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:key",
        keyHash: "hash",
        guildId: "guild",
        readAccess: { resources: ["hll-live"], gameIds: ["hell_let_loose"] },
    })
    ctx.db.seed("discordPublicPanels", {
        _id: "discordPublicPanels:one",
        guildId: "guild",
        connectionId: "gameDataConnections:one",
        enabled: true,
        kind: "scoreboard",
        revision: 1,
    })
    const args = {
        secret: "dev-internal-auth-secret",
        guildId: "guild",
        connectionId: "gameDataConnections:one",
        keyHash: "hash",
    }
    return {
        ctx,
        args,
        source,
        advance: (ms: number) => {
            clock += ms
        },
    }
}
test("HLL read uses one durable cache/lease and rechecks scope on cached reads", async (t) => {
    const { ctx, args } = fixture(t),
        reserved = await invoke(reads.reserve, ctx, args)
    assert.equal(reserved.kind, "claimed")
    assert.equal((await invoke(reads.reserve, ctx, args)).kind, "busy")
    assert.equal(
        await invoke(reads.finish, ctx, {
            ...args,
            ...reserved.claim,
            dataJson: JSON.stringify(hllLiveFixture()),
        }),
        true
    )
    assert.equal((await invoke(reads.reserve, ctx, args)).kind, "cached")
    await ctx.db.patch("apiKeys:key", { revokedAt: hllLiveTime })
    assert.equal((await invoke(reads.reserve, ctx, args)).kind, "denied")
})
test("Naše servery reads the HLL live data of its own servers only (P4-38)", async (t) => {
    const { ctx, args } = fixture(t)
    ctx.db.seed("discordPublicPanels", {
        _id: "discordPublicPanels:combined",
        guildId: "guild",
        connectionIds: ["gameDataConnections:two", "gameDataConnections:one"],
        enabled: true,
        kind: "servers",
        revision: 4,
    })
    ctx.db.seed("discordPublicPanels", {
        _id: "discordPublicPanels:elsewhere",
        guildId: "guild",
        connectionIds: ["gameDataConnections:two"],
        enabled: true,
        kind: "servers",
        revision: 1,
    })
    const panel = (panelId: string, panelRevision: number) => ({
        ...args,
        keyHash: undefined,
        panelId,
        panelRevision,
    })
    assert.equal(
        (
            await invoke(
                reads.reserve,
                ctx,
                panel("discordPublicPanels:combined", 4)
            )
        ).kind,
        "claimed"
    )
    assert.equal(
        (
            await invoke(
                reads.reserve,
                ctx,
                panel("discordPublicPanels:elsewhere", 1)
            )
        ).kind,
        "denied"
    )
    assert.equal(
        (
            await invoke(
                reads.reserve,
                ctx,
                panel("discordPublicPanels:combined", 3)
            )
        ).kind,
        "denied",
        "an old revision of the panel"
    )
})
for (const change of ["key", "source", "generation", "panel"]) {
    test(`HLL rejects an in-flight response after ${change} changes`, async (t) => {
        const { ctx, args } = fixture(t)
        const access =
            change === "panel"
                ? {
                      ...args,
                      keyHash: undefined,
                      panelId: "discordPublicPanels:one",
                      panelRevision: 1,
                  }
                : args
        const prepared = await invoke(reads.reserve, ctx, access)
        if (change === "key")
            await ctx.db.patch("apiKeys:key", { revokedAt: hllLiveTime })
        if (change === "source")
            await ctx.db.patch("gameDataConnections:one", {
                sourceFingerprint: "changed",
            })
        if (change === "generation")
            await ctx.db.patch("gameDataConnections:one", { generation: 2 })
        if (change === "panel")
            await ctx.db.patch("discordPublicPanels:one", { revision: 2 })
        assert.equal(
            await invoke(reads.finish, ctx, {
                ...access,
                ...prepared.claim,
                dataJson: JSON.stringify(hllLiveFixture()),
            }),
            false
        )
    })
}
test("HLL denies legacy, aggregate-only, wrong-game and foreign-guild keys", async (t) => {
    const { ctx, args } = fixture(t)
    for (const readAccess of [
        undefined,
        { resources: ["server-snapshots"], gameIds: ["hell_let_loose"] },
        { resources: ["hll-live"], gameIds: ["wardogs"] },
    ]) {
        await ctx.db.patch("apiKeys:key", { readAccess })
        assert.equal((await invoke(reads.reserve, ctx, args)).kind, "denied")
    }
    await ctx.db.patch("apiKeys:key", {
        guildId: "foreign",
        readAccess: { resources: ["hll-live"], gameIds: ["hell_let_loose"] },
    })
    assert.equal((await invoke(reads.reserve, ctx, args)).kind, "denied")
})
test("HLL source generation changes discard the previous provider's data", async (t) => {
    const { ctx, args, advance } = fixture(t),
        first = await invoke(reads.reserve, ctx, args)
    await invoke(reads.finish, ctx, {
        ...args,
        ...first.claim,
        dataJson: JSON.stringify(hllLiveFixture()),
    })
    await ctx.db.patch("gameDataConnections:one", { generation: 2 })
    const second = await invoke(reads.reserve, ctx, args)
    assert.equal(second.previous, undefined)
    // The old generation's data is dropped with the claim, not kept behind
    // the new generation number.
    assert.equal(ctx.db.tables.hllLiveCache[0].dataJson, undefined)
    assert.equal(ctx.db.tables.hllLivePayloads.length, 0)
    advance(40_000)
    const retry = await invoke(reads.reserve, ctx, args)
    assert.equal(retry.previous, undefined)
})
test("HLL preserves the cache backoff when the aggregate map changes", async (t) => {
    const { ctx, args, advance } = fixture(t),
        first = await invoke(reads.reserve, ctx, args),
        data = hllLiveFixture()
    data.refreshAfterSeconds = 120
    await invoke(reads.finish, ctx, {
        ...args,
        ...first.claim,
        dataJson: JSON.stringify(data),
    })
    advance(1000)
    await ctx.db.patch("gameDataConnections:one", {
        observation: {
            observedAt: new Date(Date.now()).toISOString(),
            map: "Foy Warfare",
        },
    })
    assert.equal((await invoke(reads.reserve, ctx, args)).kind, "busy")
    advance(120_000)
    assert.equal((await invoke(reads.reserve, ctx, args)).previous, undefined)
})
/** Every write a handler makes, as `<operation>:<table>` with the changed fields of a patch. */
function recordWrites(t: TestContext, ctx: ReturnType<typeof testContext>) {
    const writes: Array<{ op: string; table: string; fields: string[] }> = []
    const table = (id: string) => id.split(":")[0]!
    const patch = ctx.db.patch.bind(ctx.db)
    const insert = ctx.db.insert.bind(ctx.db)
    const remove = ctx.db.delete.bind(ctx.db)
    t.mock.method(
        ctx.db,
        "patch",
        async (id: string, value: Record<string, unknown>) => {
            writes.push({
                op: "patch",
                table: table(id),
                fields: Object.keys(value).sort(),
            })
            return await patch(id, value)
        }
    )
    t.mock.method(
        ctx.db,
        "insert",
        async (name: string, value: Record<string, unknown>) => {
            writes.push({ op: "insert", table: name, fields: [] })
            return await insert(name, value)
        }
    )
    t.mock.method(ctx.db, "delete", async (id: string) => {
        writes.push({ op: "delete", table: table(id), fields: [] })
        return await remove(id)
    })
    return writes
}
const summary = (writes: Array<{ op: string; table: string }>) =>
    writes.map((write) => `${write.op}:${write.table}`)

test("an HLL claim writes the small cache row only; the payload row is deleted once when the map changes, never copied", async (t) => {
    const { ctx, args, advance } = fixture(t),
        data = hllLiveFixture(),
        first = await invoke(reads.reserve, ctx, args)
    await invoke(reads.finish, ctx, {
        ...args,
        ...first.claim,
        dataJson: JSON.stringify(data),
    })
    const row = () => ctx.db.tables.hllLiveCache[0]
    assert.equal(row().dataJson, undefined, "the cache row holds no payload")
    assert.equal(ctx.db.tables.hllLivePayloads.length, 1)
    const stored = ctx.db.tables.hllLivePayloads[0].dataJson
    const writes = recordWrites(t, ctx)
    // The cache budget passed: the next claim keeps the payload row as
    // `previous` and writes nothing but the lease on the small row.
    advance(data.refreshAfterSeconds * 1000 + 1000)
    const second = await invoke(reads.reserve, ctx, args)
    assert.equal(second.kind, "claimed")
    assert.equal(second.previous?.fetchedAt, data.fetchedAt)
    assert.deepEqual(writes, [
        {
            op: "patch",
            table: "hllLiveCache",
            fields: [
                "fence",
                "generation",
                "leaseUntil",
                "nextAt",
                "retainUntil",
            ],
        },
    ])
    await invoke(reads.finish, ctx, {
        ...args,
        ...second.claim,
        dataJson: JSON.stringify(data),
    })
    assert.deepEqual(summary(writes), [
        "patch:hllLiveCache",
        "patch:hllLiveCache",
    ])
    assert.equal(ctx.db.tables.hllLivePayloads[0].dataJson, stored)
    // The collected observation shows another map: the data no longer
    // serves as `previous`, so the claim deletes the payload row.
    advance(data.refreshAfterSeconds * 1000 + 1000)
    ctx.db.tables.gameDataConnections[0].observation = {
        observedAt: new Date(Date.now()).toISOString(),
        map: "Foy Warfare",
    }
    writes.length = 0
    const third = await invoke(reads.reserve, ctx, args)
    assert.equal(third.kind, "claimed")
    assert.equal(third.previous, undefined)
    assert.deepEqual(summary(writes), [
        "patch:hllLiveCache",
        "delete:hllLivePayloads",
    ])
    assert.equal(ctx.db.tables.hllLivePayloads.length, 0)
    // Without data there is nothing to delete: the claim is the lease alone.
    advance(40_000)
    writes.length = 0
    const fourth = await invoke(reads.reserve, ctx, args)
    assert.equal(fourth.kind, "claimed")
    assert.deepEqual(summary(writes), ["patch:hllLiveCache"])
})
test("an unchanged HLL read writes only the small row's times; a changed one writes the payload row once; both serve the latest times", async (t) => {
    const { ctx, args, advance } = fixture(t),
        data = hllLiveFixture(),
        first = await invoke(reads.reserve, ctx, args)
    await invoke(reads.finish, ctx, {
        ...args,
        ...first.claim,
        dataJson: JSON.stringify(data),
    })
    const row = () => ctx.db.tables.hllLiveCache[0]
    const payload = () => ctx.db.tables.hllLivePayloads[0]
    const stored = payload().dataJson
    const writes = recordWrites(t, ctx)
    // The idle server reads the same; only the times moved.
    advance(data.refreshAfterSeconds * 1000 + 1000)
    const later = new Date(Date.now()).toISOString()
    const same = {
        ...data,
        fetchedAt: later,
        statusAt: later,
        playersAt: later,
    }
    const second = await invoke(reads.reserve, ctx, args)
    assert.equal(second.kind, "claimed")
    writes.length = 0
    assert.equal(
        await invoke(reads.finish, ctx, {
            ...args,
            ...second.claim,
            dataJson: JSON.stringify(same),
        }),
        true
    )
    assert.deepEqual(writes, [
        {
            op: "patch",
            table: "hllLiveCache",
            fields: [
                "fetchedAt",
                "leaseUntil",
                "nextAt",
                "playersAt",
                "retainUntil",
                "statusAt",
            ],
        },
    ])
    assert.equal(payload().dataJson, stored)
    assert.equal(row().fetchedAt, later)
    const cached = await invoke(reads.reserve, ctx, args)
    assert.equal(cached.kind, "cached")
    assert.equal(cached.data.fetchedAt, later)
    assert.equal(cached.data.statusAt, later)
    assert.equal(cached.data.playersAt, later)
    assert.equal(cached.data.status.playerCount, data.status!.playerCount)
    // A player joined: the payload row is written again, with the new times
    // on the small row.
    advance(data.refreshAfterSeconds * 1000 + 1000)
    const latest = new Date(Date.now()).toISOString()
    const changed = {
        ...same,
        fetchedAt: latest,
        statusAt: latest,
        playersAt: latest,
        status: { ...same.status!, playerCount: same.status!.playerCount + 1 },
    }
    const third = await invoke(reads.reserve, ctx, args)
    assert.equal(third.kind, "claimed")
    assert.equal(third.previous?.fetchedAt, later)
    writes.length = 0
    await invoke(reads.finish, ctx, {
        ...args,
        ...third.claim,
        dataJson: JSON.stringify(changed),
    })
    assert.deepEqual(summary(writes), [
        "patch:hllLivePayloads",
        "patch:hllLiveCache",
    ])
    assert.notEqual(payload().dataJson, stored)
    const served = await invoke(reads.reserve, ctx, args)
    assert.equal(served.kind, "cached")
    assert.equal(served.data.fetchedAt, latest)
    assert.equal(served.data.status.playerCount, data.status!.playerCount + 1)
})
test("a cache row with its payload inline from before the split is served, then moved to a payload row", async (t) => {
    const { ctx, args, advance } = fixture(t),
        data = hllLiveFixture()
    ctx.db.seed("hllLiveCache", {
        _id: "hllLiveCache:old",
        connectionId: "gameDataConnections:one",
        generation: 1,
        fence: 3,
        leaseUntil: 0,
        nextAt: Date.now() + 10_000,
        retainUntil: Date.now() + 3_600_000,
        dataJson: JSON.stringify(data),
        ...hllLiveFreshness(data),
    })
    assert.equal((await invoke(reads.reserve, ctx, args)).kind, "cached")
    advance(11_000)
    const claimed = await invoke(reads.reserve, ctx, args)
    assert.equal(claimed.kind, "claimed")
    assert.equal(claimed.previous?.fetchedAt, data.fetchedAt)
    assert.equal(ctx.db.tables.hllLiveCache[0].dataJson, undefined)
    const later = new Date(Date.now()).toISOString()
    await invoke(reads.finish, ctx, {
        ...args,
        ...claimed.claim,
        dataJson: JSON.stringify({ ...data, fetchedAt: later }),
    })
    assert.equal(ctx.db.tables.hllLivePayloads.length, 1)
    const served = await invoke(reads.reserve, ctx, args)
    assert.equal(served.kind, "cached")
    assert.equal(served.data.fetchedAt, later)
    // An expired cache row takes its payload row with it.
    advance(3_600_000)
    await invoke(reads.prune, ctx, { cacheId: "hllLiveCache:old" })
    assert.equal(ctx.db.tables.hllLiveCache.length, 0)
    assert.equal(ctx.db.tables.hllLivePayloads.length, 0)
})
test("an HLL cache row from before the time fields serves the payload's own times", async (t) => {
    const { ctx, args } = fixture(t),
        data = hllLiveFixture()
    ctx.db.seed("hllLiveCache", {
        _id: "hllLiveCache:old",
        connectionId: "gameDataConnections:one",
        generation: 1,
        fence: 3,
        leaseUntil: 0,
        nextAt: Date.now() + 10_000,
        retainUntil: Date.now() + 3_600_000,
        dataJson: JSON.stringify(data),
    })
    const cached = await invoke(reads.reserve, ctx, args)
    assert.equal(cached.kind, "cached")
    assert.equal(cached.data.fetchedAt, data.fetchedAt)
    assert.equal(cached.data.statusAt, data.statusAt)
    assert.deepEqual(cached.data, data)
})
