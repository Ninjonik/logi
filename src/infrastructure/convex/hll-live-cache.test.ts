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
