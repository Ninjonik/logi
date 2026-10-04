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
function seedBanner(
    ctx: ReturnType<typeof testContext>,
    id: string,
    overrides: Record<string, unknown> = {}
) {
    ctx.db.seed("imageAssets", {
        _id: id,
        guildId: "guild-a",
        kind: "panel-banner",
        publicId: "0123456789abcdef0123456789abcdef",
        storageId: "_storage:banner",
        contentType: "image/webp",
        width: 1920,
        height: 1080,
        bytes: 4096,
        sha256: "a".repeat(64),
        publicUrl: `https://logi.test/api/image-assets/${id}.webp`,
        state: "ready",
        createdAt: "2026-10-04T00:00:00.000Z",
        createdBy: actorFixture.subject,
        ...overrides,
    })
}
test("panel appearance verifies the banner asset, stores its URL and keeps the reference in step", async () => {
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
    seedBanner(ctx, "imageAssets:own")
    seedBanner(ctx, "imageAssets:foreign", { guildId: "guild-b" })
    seedBanner(ctx, "imageAssets:logo", { kind: "team-logo" })
    seedBanner(ctx, "imageAssets:gone", { state: "deleting" })
    const settings = {
        kind: "server",
        connectionId: "gameDataConnections:a",
        channelId: "100000000000000002",
        enabled: true,
        showPlayers: false,
        artwork: true,
        refreshSeconds: 60,
        presentation: {
            layout: { compact: true },
            accentColor: "#ff8800",
            bannerAssetId: "imageAssets:own",
            factionEmoji: { valkyra: "<:vk:123456789012345678>" },
        },
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
    const saved = await invoke(configure, ctx, args)
    assert.equal(saved.ok, true)
    const row = ctx.db.tables.discordPublicPanels[0]
    assert.deepEqual(row.presentation, {
        layout: {
            showMap: true,
            showScoreboard: true,
            showPlayerCount: true,
            compact: true,
        },
        accentColor: "#ff8800",
        bannerAssetId: "imageAssets:own",
        bannerUrl: "https://logi.test/api/image-assets/imageAssets:own.webp",
        factionEmoji: { valkyra: "<:vk:123456789012345678>" },
    })
    assert.deepEqual(
        ctx.db.tables.imageAssetReferences.map((r) => [
            r.owner,
            r.ownerId,
            r.assetId,
        ]),
        [["panel", saved.id, "imageAssets:own"]]
    )
    // A client-supplied URL is never trusted: the production argument validator
    // rejects the field and the handler always rewrites it from the asset.
    await invoke(configure, ctx, {
        ...args,
        settings: {
            ...settings,
            presentation: {
                ...settings.presentation,
                bannerUrl: "https://evil.test/x.png",
            },
        },
    })
    assert.equal(
        ctx.db.tables.discordPublicPanels[0].presentation.bannerUrl,
        "https://logi.test/api/image-assets/imageAssets:own.webp"
    )
    for (const bannerAssetId of [
        "imageAssets:foreign",
        "imageAssets:logo",
        "imageAssets:gone",
        "imageAssets:missing",
    ]) {
        assert.deepEqual(
            await invoke(configure, ctx, {
                ...args,
                settings: {
                    ...settings,
                    presentation: { ...settings.presentation, bannerAssetId },
                },
            }),
            { error: "asset_unavailable" },
            bannerAssetId
        )
    }
    assert.equal(
        ctx.db.tables.discordPublicPanels[0].presentation.bannerAssetId,
        "imageAssets:own"
    )
    assert.equal(ctx.db.tables.imageAssetReferences.length, 1)
    await assert.rejects(
        invoke(configure, ctx, {
            ...args,
            settings: {
                ...settings,
                presentation: { accentColor: "orange" },
            },
        })
    )
    // Removing the banner dereferences it; the record stays complete.
    await invoke(configure, ctx, {
        ...args,
        settings: {
            ...settings,
            presentation: { ...settings.presentation, bannerAssetId: null },
        },
    })
    assert.equal(ctx.db.tables.imageAssetReferences.length, 0)
    assert.equal(
        ctx.db.tables.discordPublicPanels[0].presentation.bannerUrl,
        null
    )
    assert.equal(ctx.db.tables.discordPublicPanels.length, 1)
})
test("legacy saves without presentation clear a stored appearance and its banner reference", async () => {
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
    seedBanner(ctx, "imageAssets:own")
    const settings = {
        kind: "scoreboard",
        connectionId: "gameDataConnections:a",
        channelId: "100000000000000003",
        enabled: true,
        showPlayers: false,
        artwork: false,
        refreshSeconds: 30,
    }
    const args = {
        secret,
        guildId: "guild-a",
        actor: actorFixture,
        settings: {
            ...settings,
            presentation: { bannerAssetId: "imageAssets:own" },
        },
        verifiedChannel: {
            id: settings.channelId,
            guildId: "guild-a",
            type: 0,
            canPublish: true,
        },
    }
    await invoke(configure, ctx, args)
    assert.equal(ctx.db.tables.imageAssetReferences.length, 1)
    const legacy = await invoke(configure, ctx, { ...args, settings })
    assert.equal(legacy.ok, true)
    assert.equal(ctx.db.tables.imageAssetReferences.length, 0)
    assert.equal(ctx.db.tables.discordPublicPanels[0].presentation, undefined)
    const listed = await invoke(list, ctx, {
        secret,
        guildId: "guild-a",
        actor: actorFixture,
    })
    assert.equal(listed.panels[0].presentation, undefined)
})
test("panels can share one workspace banner; clearing it on one keeps the other's reference", async () => {
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
    seedBanner(ctx, "imageAssets:shared")
    const save = (kind: string, channelId: string, banner: string | null) =>
        invoke(configure, ctx, {
            secret,
            guildId: "guild-a",
            actor: actorFixture,
            settings: {
                kind,
                connectionId: "gameDataConnections:a",
                channelId,
                enabled: true,
                showPlayers: false,
                artwork: true,
                refreshSeconds: 60,
                presentation: { bannerAssetId: banner },
            },
            verifiedChannel: {
                id: channelId,
                guildId: "guild-a",
                type: 0,
                canPublish: true,
            },
        })
    const server = await save(
        "server",
        "100000000000000004",
        "imageAssets:shared"
    )
    const board = await save(
        "scoreboard",
        "100000000000000005",
        "imageAssets:shared"
    )
    assert.equal(server.ok, true)
    assert.equal(board.ok, true)
    assert.notEqual(server.id, board.id)
    const references = () =>
        ctx.db.tables.imageAssetReferences
            .map((r) => `${r.ownerId}:${r.assetId}`)
            .sort()
    assert.deepEqual(
        references(),
        [
            `${server.id}:imageAssets:shared`,
            `${board.id}:imageAssets:shared`,
        ].sort()
    )
    await save("server", "100000000000000004", null)
    assert.deepEqual(references(), [`${board.id}:imageAssets:shared`])
})
