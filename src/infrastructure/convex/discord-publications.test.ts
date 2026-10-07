import {
    bindings,
    claim,
    finish,
    save,
} from "../../../convex/discordPublications"
import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import { list, resultsPage } from "../../../convex/discordPublicPanels"
import { configure } from "../../../convex/discordPublicPanelsAdmin"
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
/** Counts every insert and patch the handlers make. */
function countWrites(ctx: ReturnType<typeof testContext>) {
    const writes: string[] = []
    const insert = ctx.db.insert.bind(ctx.db)
    const patch = ctx.db.patch.bind(ctx.db)
    ctx.db.insert = async (table, value) => {
        writes.push(`insert:${table}`)
        return await insert(table, value)
    }
    ctx.db.patch = async (id, value) => {
        writes.push(`patch:${id.split(":")[0]}`)
        return await patch(id, value)
    }
    return writes
}
test("an unchanged message confirmed within ten minutes is current without a write; a publish is the claim and one finish", async (t) => {
    let clock = Date.parse("2026-10-07T12:00:00.000Z")
    t.mock.method(Date, "now", () => clock)
    const ctx = testContext()
    const writes = countWrites(ctx)
    const target = { hash: "h1", channelId: "channel" }
    const args = { secret, guildId: "guild-a", key: "calendar", revision: 1 }
    const publishOnce = async (hash: string) => {
        const claimed = await invoke(claim, ctx, { ...args, ...target, hash })
        if (!claimed || claimed.current) return claimed
        await invoke(finish, ctx, {
            secret,
            id: claimed.id,
            fence: claimed.fence,
            state: {
                channelId: "channel",
                messageId: "message",
                pending: null,
                hash,
            },
        })
        return claimed
    }
    await publishOnce("h1")
    assert.deepEqual(writes, [
        "insert:discordPublications",
        "patch:discordPublications",
        "patch:discordPublications",
    ])
    const row = ctx.db.tables.discordPublications[0]
    assert.equal(row.hash, "h1")
    assert.equal(row.messageId, "message")
    assert.equal(row.leaseUntil, 0)
    // The next minute renders the same: nothing is written.
    writes.length = 0
    clock += 60_000
    const current = await publishOnce("h1")
    assert.equal(current.current, true)
    assert.equal(current.messageId, "message")
    assert.deepEqual(writes, [])
    // A changed render: the claim and the finish carrying the state.
    clock += 60_000
    await publishOnce("h2")
    assert.deepEqual(writes, [
        "patch:discordPublications",
        "patch:discordPublications",
    ])
    assert.equal(row.hash, "h2")
    // Ten minutes after the last confirmation the same render is checked again.
    writes.length = 0
    clock += 10 * 60_000
    assert.equal((await publishOnce("h2")).current, undefined)
    assert.equal(writes.length, 2)
    // Another channel, or an old bot that sends no hash, always takes the lease.
    writes.length = 0
    const moved = await invoke(claim, ctx, {
        ...args,
        hash: "h2",
        channelId: "elsewhere",
    })
    assert.equal(moved.current, undefined)
    await invoke(finish, ctx, { secret, id: moved.id, fence: moved.fence })
    const old = await invoke(claim, ctx, args)
    assert.equal(old.current, undefined)
    assert.ok(old.fence > moved.fence)
})
test("a finish that stores the state needs the lease, like save", async (t) => {
    let clock = Date.parse("2026-10-07T12:00:00.000Z")
    t.mock.method(Date, "now", () => clock)
    const ctx = testContext()
    const first = await invoke(claim, ctx, {
        secret,
        guildId: "guild-a",
        key: "calendar",
        revision: 1,
    })
    clock += 120_001
    const state = {
        channelId: "channel",
        messageId: "message",
        pending: null,
        hash: "h1",
    }
    await assert.rejects(
        invoke(finish, ctx, {
            secret,
            id: first.id,
            fence: first.fence,
            state,
        }),
        /lease/
    )
    assert.equal(ctx.db.tables.discordPublications[0].hash, null)
    // The failure is recorded without the state.
    await invoke(finish, ctx, {
        secret,
        id: first.id,
        fence: first.fence,
        state,
        error: "Chyba",
    })
    assert.equal(ctx.db.tables.discordPublications[0].hash, null)
    assert.equal(ctx.db.tables.discordPublications[0].error, "Chyba")
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

test("result pages add the card facts: category, sides, confirming admin and public page", async () => {
    const ctx = testContext()
    seedDashboardActor(ctx.db)
    ctx.db.seed("discordPublicPanels", {
        _id: "discordPublicPanels:p",
        guildId: "guild-a",
        kind: "results",
        gameId: "hell_let_loose",
    })
    await ctx.db.patch("guilds:admin", {
        eventCategories: [{ id: "friendly", label: "Přátelák", color: "#000" }],
    })
    ctx.db.seed("users", {
        _id: "users:reviewer",
        discordId: "900000000000000001",
        name: "Reviewer Account",
        nicknames: { "guild-a": "Hráč 01" },
    })
    const reviewed = { status: "confirmed", version: 2 }
    ctx.db.seed("events", {
        _id: "events:card",
        guildId: "guilds:admin",
        gameId: "hell_let_loose",
        name: "VLK vs DEF",
        matchType: "Friendly",
        side: "Allies",
        matchStatsId: "matchStats:card",
        eventResult: {
            outcome: "victory",
            score: { sideA: 2, sideB: 3 },
        },
        matchTeams: [
            {
                slot: "b",
                side: "Axis",
                snapshot: { name: "Defenders", shortCode: null },
            },
            {
                slot: "a",
                side: "Allies",
                snapshot: { name: "Valkyrie", shortCode: "VLK" },
            },
        ],
        reviewedResultGameId: "hell_let_loose",
        reviewedResult: reviewed,
    })
    ctx.db.seed("matchStats", {
        _id: "matchStats:card",
        eventId: "events:card",
    })
    for (const [version, reviewerId] of [
        [1, "900000000000000009"],
        [2, "900000000000000001"],
    ] as const)
        ctx.db.seed("eventResultRevisions", {
            _id: `eventResultRevisions:${version}`,
            eventId: "events:card",
            guildId: "guilds:admin",
            gameId: "hell_let_loose",
            version,
            revision: { reviewerId },
        })
    ctx.db.seed("events", {
        _id: "events:bare",
        guildId: "guilds:admin",
        gameId: "hell_let_loose",
        name: "Bare",
        reviewedResultGameId: "hell_let_loose",
        reviewedResult: { status: "confirmed", version: 1 },
    })

    const page = await invoke(resultsPage, ctx, {
        secret,
        panelId: "discordPublicPanels:p",
        cursor: null,
    })
    const card = (name: string) =>
        page.events.find((event: { name: string }) => event.name === name)?.card
    assert.deepEqual(card("VLK vs DEF"), {
        category: "Přátelák",
        side: "Allies",
        teams: [
            { code: "VLK", side: "Allies" },
            { code: "Defenders", side: "Axis" },
        ],
        reviewer: "Hráč 01",
        publicMatch: true,
        imported: { outcome: "victory", score: { sideA: 2, sideB: 3 } },
        playedAt: null,
        previous: null,
        league: null,
    })
    assert.deepEqual(card("Bare"), {
        category: null,
        side: null,
        teams: [],
        reviewer: null,
        publicMatch: false,
        imported: null,
        playedAt: null,
        previous: null,
        league: null,
    })
})
test("bindings read one owner's keys through a prefix range of the guild index, or every key without a prefix", async () => {
    const ctx = testContext()
    const row = (id: string, guildId: string, key: string) =>
        ctx.db.seed("discordPublications", {
            _id: `discordPublications:${id}`,
            guildId,
            key,
            revision: 1,
            channelId: null,
            messageId: null,
            pending: null,
            hash: null,
            fence: 0,
            leaseUntil: 0,
            retryAt: 0,
            lastSuccessAt: null,
            error: null,
        })
    const own = [
        "calendar",
        "league:leagueTrackedMatches:1",
        "panel:a",
        "panel:a:result:events:1",
        "panel:b",
        "panels",
        "seed:call:run-1",
        "seed;odd",
    ]
    own.forEach((key, index) => row(String(index), "guild-a", key))
    row("foreign", "guild-b", "seed:call:run-2")
    const keys = async (prefix?: string) =>
        (
            (await invoke(bindings, ctx, {
                secret,
                guildId: "guild-a",
                ...(prefix === undefined ? {} : { prefix }),
            })) as Array<{ key: string }>
        )
            .map((binding) => binding.key)
            .sort()
    assert.deepEqual(await keys("seed:"), ["seed:call:run-1"])
    assert.deepEqual(await keys("panel:a"), [
        "panel:a",
        "panel:a:result:events:1",
    ])
    assert.deepEqual(await keys("panel:"), [
        "panel:a",
        "panel:a:result:events:1",
        "panel:b",
    ])
    assert.deepEqual(await keys("league:"), ["league:leagueTrackedMatches:1"])
    assert.deepEqual(await keys("calendar"), ["calendar"])
    assert.deepEqual(await keys(""), own)
    assert.deepEqual(await keys(), own)
    await assert.rejects(
        invoke(bindings, ctx, {
            secret,
            guildId: "guild-a",
            prefix: "p".repeat(151),
        })
    )
})
