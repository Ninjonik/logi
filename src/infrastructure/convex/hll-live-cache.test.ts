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
test("an HLL claim patches the lease only; the large data is dropped once when the map changes, never copied", async (t) => {
    const { ctx, args, advance } = fixture(t),
        data = hllLiveFixture(),
        first = await invoke(reads.reserve, ctx, args)
    await invoke(reads.finish, ctx, {
        ...args,
        ...first.claim,
        dataJson: JSON.stringify(data),
    })
    const row = () => ctx.db.tables.hllLiveCache[0]
    const stored = row().dataJson
    assert.ok(stored)
    const patches: Array<Record<string, unknown>> = []
    const patch = ctx.db.patch.bind(ctx.db)
    t.mock.method(
        ctx.db,
        "patch",
        async (id: string, value: Record<string, unknown>) => {
            patches.push(value)
            return await patch(id, value)
        }
    )
    // The cache budget passed: the next claim keeps the data as `previous`
    // and writes nothing but the lease (every version is retained for days).
    advance(data.refreshAfterSeconds * 1000 + 1000)
    const second = await invoke(reads.reserve, ctx, args)
    assert.equal(second.kind, "claimed")
    assert.equal(second.previous?.fetchedAt, data.fetchedAt)
    assert.deepEqual(
        patches.map((value) => Object.keys(value).sort()),
        [["fence", "generation", "leaseUntil", "nextAt", "retainUntil"]]
    )
    assert.equal(row().dataJson, stored)
    await invoke(reads.finish, ctx, {
        ...args,
        ...second.claim,
        dataJson: JSON.stringify(data),
    })
    // The collected observation shows another map: the data no longer
    // serves as `previous`, so the claim drops it in its one patch.
    advance(data.refreshAfterSeconds * 1000 + 1000)
    ctx.db.tables.gameDataConnections[0].observation = {
        observedAt: new Date(Date.now()).toISOString(),
        map: "Foy Warfare",
    }
    const third = await invoke(reads.reserve, ctx, args)
    assert.equal(third.kind, "claimed")
    assert.equal(third.previous, undefined)
    const last = patches[patches.length - 1]
    assert.ok("dataJson" in last)
    assert.equal(last.dataJson, undefined)
    assert.equal(row().dataJson, undefined)
    // Without data there is nothing to drop: the claim is the lease alone.
    advance(40_000)
    const fourth = await invoke(reads.reserve, ctx, args)
    assert.equal(fourth.kind, "claimed")
    assert.ok(!("dataJson" in patches[patches.length - 1]))
})
