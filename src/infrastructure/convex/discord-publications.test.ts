import {
    configure,
    list,
    resultsPage,
} from "../../../convex/discordPublicPanels"
import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import { claim, save, finish } from "../../../convex/discordPublications"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"
process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
test("result pages use native workspace identity, scope the game and exclude unreviewed or cross-game results", async () => {
    const ctx = testContext()
    seedDashboardActor(ctx.db)
    ctx.db.seed("discordPublicPanels", {
        _id: "discordPublicPanels:p",
        guildId: "guild-a",
        kind: "results",
        gameId: "wardogs",
    })
    const result = { status: "confirmed", version: 1 }
    for (const [id, guildId, gameId, reviewedResultGameId, status] of [
        ["yes", "guilds:admin", "wardogs", "wardogs", "confirmed"],
        ["foreign", "guilds:other", "wardogs", "wardogs", "confirmed"],
        [
            "hll",
            "guilds:admin",
            "hell_let_loose",
            "hell_let_loose",
            "confirmed",
        ],
        ["unreviewed", "guilds:admin", "wardogs", "wardogs", "provisional"],
        [
            "wrong-proof",
            "guilds:admin",
            "wardogs",
            "hell_let_loose",
            "confirmed",
        ],
    ])
        ctx.db.seed("events", {
            _id: `events:${id}`,
            guildId,
            gameId,
            reviewedResultGameId,
            reviewedResult: { ...result, status },
            name: id,
        })
    const page = await invoke(resultsPage, ctx, {
        secret,
        panelId: "discordPublicPanels:p",
        cursor: null,
    })
    assert.deepEqual(
        page.events.map((event: { name: string }) => event.name),
        ["yes", "unreviewed", "wrong-proof"]
    )
    assert.deepEqual(
        page.events.map((event: { result: unknown }) => event.result),
        [result, null, null]
    )
})
test("durable lease serializes workers, retains uncertain attempts and fences old acknowledgements", async () => {
    const ctx = testContext()
    const args = { secret, guildId: "guild-a", key: "calendar", revision: 1 }
    const first = await invoke(claim, ctx, args)
    assert.equal(await invoke(claim, ctx, args), null)
    await invoke(save, ctx, {
        secret,
        ...first,
        pending: { channelId: "channel", marker: "attempt" },
    })
    await invoke(finish, ctx, { secret, id: first.id, fence: first.fence })
    const second = await invoke(claim, ctx, args)
    assert.equal(second.pending.marker, "attempt")
    await assert.rejects(invoke(save, ctx, { secret, ...first }), /lease/)
    assert.equal(
        await invoke(claim, ctx, { ...args, secret: "wrong" }).catch(
            () => "denied"
        ),
        "denied"
    )
})
test("panel management rejects revoked dashboard identity and foreign source before writes", async () => {
    const ctx = testContext()
    seedDashboardActor(ctx.db)
    ctx.db.tables.gameDataConnections = [
        {
            _id: "gameDataConnections:a",
            guildId: "guild-a",
            gameId: "wardogs",
            enabled: true,
        },
    ]
    const settings = {
        kind: "server",
        connectionId: "gameDataConnections:a",
        channelId: "100000000000000002",
        enabled: true,
        showPlayers: false,
        artwork: true,
        refreshSeconds: 60,
    }
    const args = {
        secret,
        guildId: "guild-a",
        actor: actorFixture,
        settings,
        verifiedChannel: {
            id: settings.channelId,
            guildId: "guild-a",
            type: 0,
            canPublish: true,
        },
    }
    await invoke(configure, ctx, args)
    assert.equal(
        (
            await invoke(list, ctx, {
                secret,
                guildId: "guild-a",
                actor: actorFixture,
            })
        ).panels.length,
        1
    )
    await assert.rejects(
        invoke(configure, ctx, {
            ...args,
            verifiedChannel: { ...args.verifiedChannel, guildId: "other" },
        })
    )
    ctx.db.tables.gameDataConnections[0].guildId = "other"
    await assert.rejects(invoke(configure, ctx, args))
    ctx.db.tables.dashboardSessions[0].revokedAt = Date.now()
    await assert.rejects(invoke(configure, ctx, args), /Forbidden/)
    assert.equal(ctx.db.tables.discordPublicPanels.length, 1)
})
