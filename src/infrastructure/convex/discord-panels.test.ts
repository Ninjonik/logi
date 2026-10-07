import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import * as panelBotWrites from "../../../convex/discordPanelBotWrites"
import * as publicPanels from "../../../convex/discordPublicPanels"
import { sourceSchema } from "../../domain/game-data/contracts"
import * as panelBot from "../../../convex/discordPanelBot"
import { invoke, testContext } from "./testing/database"
import * as panels from "../../../convex/discordPanels"
import * as reads from "../../../convex/hllLiveReads"
import { hllLiveFixture } from "../testing/hll-live"

const secret = "synthetic-panels-secret"
const guildId = "100000000000000099"
const channelId = "123456789012345678"
const now = Date.parse("2026-10-05T10:00:00.000Z")

/** One workspace with an admin, one usable HLL server and the clock fixed. */
function fixture(t: TestContext) {
    const previous = {
        secret: process.env.INTERNAL_AUTH_SECRET,
        sources: process.env.LOGI_GAME_DATA_SOURCES,
        site: process.env.SITE_URL,
    }
    const source = sourceSchema.parse({
        ref: "hll",
        guildId,
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        providerServerId: "1",
        origin: "https://crcon.example",
        secretRef: null,
    })
    process.env.INTERNAL_AUTH_SECRET = secret
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([source])
    process.env.SITE_URL = "https://logi.app"
    t.after(() => {
        for (const [key, value] of [
            ["INTERNAL_AUTH_SECRET", previous.secret],
            ["LOGI_GAME_DATA_SOURCES", previous.sources],
            ["SITE_URL", previous.site],
        ] as const) {
            if (value === undefined) delete process.env[key]
            else process.env[key] = value
        }
    })
    let clock = now
    t.mock.method(Date, "now", () => clock)
    const ctx = testContext()
    seedDashboardActor(ctx.db, guildId)
    ctx.db.seed("gameDataConnections", {
        _id: "gameDataConnections:hll",
        guildId,
        sourceRef: "hll",
        sourceFingerprint: JSON.stringify(source),
        generation: 1,
        enabled: true,
        provider: "hll_crcon",
        gameId: "hell_let_loose",
        observation: { displayName: "Vlci #1 · Public" },
    })
    const dashboard = { secret, guildId, actor: actorFixture }
    return {
        ctx,
        dashboard,
        advance: (ms: number) => {
            clock += ms
        },
    }
}

const serverPanel = {
    kind: "server",
    channelId,
    connectionId: "gameDataConnections:hll",
}

test("every dashboard panel function requires the session gateway and a clan admin", async (t) => {
    const { ctx, dashboard } = fixture(t)
    await assert.rejects(
        invoke(panels.overview, ctx, { ...dashboard, secret: "wrong" }),
        /Unauthorized/
    )
    await assert.rejects(
        invoke(panels.overview, ctx, {
            ...dashboard,
            actor: { ...actorFixture, sid: "b".repeat(43) },
        }),
        /Forbidden/
    )
    // A member without the admin or dashboard role.
    ctx.db.tables.discordMemberAccess![0]!.isAdmin = false
    ctx.db.tables.discordMemberAccess![0]!.hasDashboardAccess = false
    for (const [fn, args] of [
        [panels.overview, {}],
        [
            panels.save,
            {
                panelId: null,
                settings: serverPanel,
                send: false,
                expectedRevision: null,
            },
        ],
        [panels.act, { panelId: "discordPublicPanels:1", action: "refresh" }],
        [
            panels.setServer,
            {
                connectionId: "gameDataConnections:hll",
                address: "203.0.113.24:7777",
            },
        ],
    ] as const)
        await assert.rejects(
            invoke(fn, ctx, { ...dashboard, ...args }),
            /Forbidden/
        )
    assert.equal(ctx.db.tables.discordPublicPanels, undefined)
})

test("save, Odeslat do kanálu, the bot's pass and the overview work end to end", async (t) => {
    const { ctx, dashboard, advance } = fixture(t)
    const saved = await invoke(panels.save, ctx, {
        ...dashboard,
        panelId: null,
        settings: serverPanel,
        send: false,
        expectedRevision: null,
    })
    assert.equal(saved.status, "saved")
    assert.equal(saved.sent, false)
    let view = await invoke(panels.overview, ctx, dashboard)
    assert.equal(view.panels[0].state, "unsent")
    assert.equal(view.counts.unsent, 1)
    assert.equal(view.bot.state, "unknown")

    advance(1_000)
    const posted = await invoke(panels.act, ctx, {
        ...dashboard,
        panelId: saved.id,
        action: "publish",
    })
    assert.equal(posted.status, "accepted")
    view = await invoke(panels.overview, ctx, dashboard)
    assert.equal(view.panels[0].state, "waiting")

    // The bot checks in, takes the request and confirms the message.
    advance(5_000)
    await invoke(panelBotWrites.heartbeat, ctx, {
        secret,
        heartbeat: { version: "1.0.268", protocol: 2, startedAt: now },
        guildIds: [guildId],
    })
    ctx.db.seed("discordPublications", {
        _id: "discordPublications:1",
        guildId,
        key: `panel:${saved.id}`,
        channelId,
        messageId: "223456789012345678",
        pending: null,
        lastSuccessAt: Date.now(),
        retryAt: 0,
        leaseUntil: 0,
        error: null,
    })
    await invoke(panelBotWrites.report, ctx, {
        secret,
        guildId,
        panelId: saved.id,
        attempt: {
            attemptAt: Date.now(),
            ok: true,
            error: null,
            nextAt: Date.now() + 60_000,
            dataAt: Date.now() - 2_000,
            handledRequestAt: posted.requestedAt,
            warnings: [],
            messages: 1,
        },
    })
    view = await invoke(panels.overview, ctx, dashboard)
    const item = view.panels[0]
    assert.equal(item.state, "published")
    assert.equal(view.bot.state, "online")
    assert.equal(view.bot.version, "1.0.268")
    assert.equal(view.botInServer, true)
    assert.deepEqual(item.message, {
        channelId,
        messageId: "223456789012345678",
    })
    assert.equal(item.timeline.claimedAt, Date.now())
    assert.equal(item.timeline.nextUpdateAt, Date.now() + 60_000)
    assert.equal(view.sources[0]?.connectionId, "gameDataConnections:hll")
})

test("the heartbeat is one bot row with the visited workspaces, stored at most once a minute", async (t) => {
    const { ctx, dashboard, advance } = fixture(t)
    await invoke(panels.save, ctx, {
        ...dashboard,
        panelId: null,
        settings: serverPanel,
        send: true,
        expectedRevision: null,
    })
    // Rows of the earlier layout: one per workspace.
    for (const id of [guildId, "200000000000000099"])
        ctx.db.seed("discordBotHeartbeats", {
            _id: `discordBotHeartbeats:${id}`,
            key: `guild:${id}`,
            version: "1.0.268",
            protocol: 2,
            startedAt: now,
            seenAt: now,
        })
    ctx.db.seed("discordBotHeartbeats", {
        _id: "discordBotHeartbeats:bot",
        key: "bot",
        version: "1.0.268",
        protocol: 2,
        startedAt: now,
        seenAt: now,
    })
    // Before the list exists, presence comes from the workspace's own row.
    assert.equal(
        (await invoke(panels.overview, ctx, dashboard)).botInServer,
        true
    )
    const writes: string[] = []
    const patch = ctx.db.patch.bind(ctx.db)
    ctx.db.patch = async (id, value) => {
        writes.push(id)
        return await patch(id, value)
    }
    const beat = {
        secret,
        heartbeat: { version: "1.1.0", protocol: 2, startedAt: now },
        guildIds: [guildId],
    }
    advance(30_000)
    await invoke(panelBotWrites.heartbeat, ctx, beat)
    assert.deepEqual(writes, ["discordBotHeartbeats:bot"])
    assert.deepEqual(
        ctx.db.tables.discordBotHeartbeats!.map((row) => row.key),
        ["bot"],
        "the per-workspace rows are gone with the first list"
    )
    assert.deepEqual(ctx.db.tables.discordBotHeartbeats![0]!.guildIds, [
        guildId,
    ])
    // A bot still beating every 30 s: stored once a minute.
    advance(30_000)
    await invoke(panelBotWrites.heartbeat, ctx, beat)
    assert.equal(writes.length, 1)
    advance(30_000)
    await invoke(panelBotWrites.heartbeat, ctx, beat)
    assert.equal(writes.length, 2)
    let view = await invoke(panels.overview, ctx, dashboard)
    assert.equal(view.bot.state, "online")
    assert.equal(view.botInServer, true)
    // The bot stopped visiting this workspace.
    advance(90_000)
    await invoke(panelBotWrites.heartbeat, ctx, { ...beat, guildIds: [] })
    view = await invoke(panels.overview, ctx, dashboard)
    assert.equal(view.botInServer, false)
})

test("a pass that changes nothing is reported without a write; ten minutes later it is stored", async (t) => {
    const { ctx, dashboard, advance } = fixture(t)
    const saved = await invoke(panels.save, ctx, {
        ...dashboard,
        panelId: null,
        settings: serverPanel,
        send: true,
        expectedRevision: null,
    })
    const writes: string[] = []
    const patch = ctx.db.patch.bind(ctx.db)
    const insert = ctx.db.insert.bind(ctx.db)
    ctx.db.patch = async (id, value) => {
        writes.push(id.split(":")[0]!)
        return await patch(id, value)
    }
    ctx.db.insert = async (table, value) => {
        writes.push(table)
        return await insert(table, value)
    }
    const report = (attempt: Record<string, unknown> = {}) =>
        invoke(panelBotWrites.report, ctx, {
            secret,
            guildId,
            panelId: saved.id,
            attempt: {
                attemptAt: Date.now(),
                ok: true,
                error: null,
                nextAt: Date.now() + 60_000,
                dataAt: Date.now() - 2_000,
                handledRequestAt: null,
                warnings: [],
                messages: 1,
                channelPrivate: false,
                ...attempt,
            },
        })
    await report()
    assert.deepEqual(writes, ["discordPanelStatus"])
    for (let minute = 1; minute < 10; minute++) {
        advance(60_000)
        await report()
    }
    assert.equal(writes.length, 1, "nine unchanged passes write nothing")
    advance(60_000)
    await report()
    assert.equal(writes.length, 2, "the tenth minute refreshes the times")
    advance(60_000)
    await report({ warnings: ["attach_files_missing"] })
    assert.equal(writes.length, 3, "a new warning is stored at once")
    const status = ctx.db.tables.discordPanelStatus![0]!
    assert.deepEqual(status.warnings, ["attach_files_missing"])
})

test("pause is a real flag kept across saves; the control message resumes by server", async (t) => {
    const { ctx, dashboard } = fixture(t)
    const saved = await invoke(panels.save, ctx, {
        ...dashboard,
        panelId: null,
        settings: serverPanel,
        send: true,
        expectedRevision: null,
    })
    await invoke(panels.act, ctx, {
        ...dashboard,
        panelId: saved.id,
        action: "pause",
    })
    const resaved = await invoke(panels.save, ctx, {
        ...dashboard,
        panelId: saved.id,
        settings: { ...serverPanel, title: "Vlci #1" },
        send: false,
        expectedRevision: saved.revision,
    })
    assert.equal(resaved.status, "saved")
    const row = ctx.db.tables.discordPublicPanels!.find(
        (panel) => panel._id === saved.id
    )!
    assert.equal(row.paused, true)
    assert.equal(row.pausedBy, actorFixture.subject)
    assert.equal(row.title, "Vlci #1")

    const resumed = await invoke(panelBotWrites.act, ctx, {
        secret,
        guildId,
        actorId: "100000000000000002",
        action: "resume",
        connectionId: "gameDataConnections:hll",
    })
    assert.equal(resumed.status, "accepted")
    assert.equal(row.paused, false)
    await assert.rejects(
        invoke(panelBotWrites.act, ctx, {
            secret,
            guildId,
            actorId: "not-a-user",
            action: "pause",
            connectionId: "gameDataConnections:hll",
        }),
        /Invalid actor/
    )
})

test("a legacy disabled panel stays paused when the new editor saves it", async (t) => {
    const { ctx, dashboard } = fixture(t)
    ctx.db.seed("discordPublicPanels", {
        _id: "discordPublicPanels:legacy",
        guildId,
        kind: "scoreboard",
        gameId: "hell_let_loose",
        channelId,
        connectionId: "gameDataConnections:hll",
        enabled: false,
        showPlayers: true,
        artwork: false,
        refreshSeconds: 30,
        revision: 5,
        createdAt: 1,
    })
    const saved = await invoke(panels.save, ctx, {
        ...dashboard,
        panelId: "discordPublicPanels:legacy",
        settings: serverPanel,
        send: false,
        expectedRevision: 5,
    })
    assert.equal(saved.status, "saved")
    const row = ctx.db.tables.discordPublicPanels![0]!
    assert.equal(row.kind, "server")
    assert.equal(row.paused, true)
    const view = await invoke(panels.overview, ctx, dashboard)
    assert.equal(view.panels[0].state, "paused")
})

test("one results panel per game", async (t) => {
    const { ctx, dashboard } = fixture(t)
    const results = {
        kind: "results",
        channelId,
        gameId: "hell_let_loose",
    }
    const first = await invoke(panels.save, ctx, {
        ...dashboard,
        panelId: null,
        settings: results,
        send: true,
        expectedRevision: null,
    })
    assert.equal(first.status, "saved")
    assert.deepEqual(
        await invoke(panels.save, ctx, {
            ...dashboard,
            panelId: null,
            settings: { ...results, channelId: "123456789012345679" },
            send: true,
            expectedRevision: null,
        }),
        { status: "invalid", reason: "results_exists" }
    )
})

test("server join details: validated, a unique global link, the password only as an envelope", async (t) => {
    const { ctx, dashboard } = fixture(t)
    assert.deepEqual(
        await invoke(panels.setServer, ctx, {
            ...dashboard,
            connectionId: "gameDataConnections:hll",
            address: "not an address",
        }),
        { status: "invalid", field: "address" }
    )
    assert.deepEqual(
        await invoke(panels.setServer, ctx, {
            ...dashboard,
            connectionId: "gameDataConnections:other",
            address: "203.0.113.24:7777",
        }),
        { status: "not_found" }
    )
    ctx.db.seed("discordPanelServers", {
        _id: "discordPanelServers:taken",
        guildId: "200000000000000099",
        connectionId: "elsewhere",
        slug: "vlci-1",
        address: null,
        joinCode: null,
        password: null,
        passwordUpdatedAt: null,
        updatedAt: 1,
    })
    const envelope = {
        format: 1,
        keyId: "key-1",
        nonce: "A".repeat(16),
        ciphertext: "B".repeat(24),
        tag: "C".repeat(22),
    }
    const saved = await invoke(panels.setServer, ctx, {
        ...dashboard,
        connectionId: "gameDataConnections:hll",
        address: "203.0.113.24:7777",
        password: envelope,
    })
    assert.deepEqual(saved, {
        status: "saved",
        slug: "vlci-1-2",
        joinUrl: "https://logi.app/join/vlci-1-2",
    })
    const view = await invoke(panels.overview, ctx, dashboard)
    assert.deepEqual(view.servers, [
        {
            connectionId: "gameDataConnections:hll",
            slug: "vlci-1-2",
            joinUrl: "https://logi.app/join/vlci-1-2",
            address: "203.0.113.24:7777",
            joinCode: null,
            hasPassword: true,
        },
    ])
    assert.doesNotMatch(JSON.stringify(view), /BBBBBBBB|key-1/)

    // The public join page: name, address and players; never the password.
    const page = await invoke(panelBot.joinPage, ctx, {
        secret,
        slug: "vlci-1-2",
    })
    assert.equal(page.gameId, "hell_let_loose")
    assert.equal(page.address, "203.0.113.24:7777")
    assert.equal(page.joinCode, null)
    assert.deepEqual(Object.keys(page).sort(), [
        "address",
        "capacity",
        "gameId",
        "joinCode",
        "name",
        "players",
        "queue",
    ])
    assert.doesNotMatch(JSON.stringify(page), /BBBBBBBB|key-1/)
    assert.equal(
        await invoke(panelBot.joinPage, ctx, { secret, slug: "../x" }),
        null
    )
    await assert.rejects(
        invoke(panelBot.joinPage, ctx, { secret: "wrong", slug: "vlci-1-2" }),
        /Unauthorized/
    )

    // The envelope reaches the bot only for a server panel with the switch on.
    const saveServer = (password: boolean) =>
        invoke(panels.save, ctx, {
            ...dashboard,
            panelId: null,
            settings: {
                ...serverPanel,
                channelId: password ? "123456789012345670" : channelId,
                content: { password },
            },
            send: true,
            expectedRevision: null,
        })
    const off = await saveServer(false)
    const on = await saveServer(true)
    assert.equal(
        await invoke(panelBot.passwordEnvelope, ctx, {
            guildId,
            panelId: off.id,
        }),
        null
    )
    assert.deepEqual(
        await invoke(panelBot.passwordEnvelope, ctx, {
            guildId,
            panelId: on.id,
        }),
        { connectionId: "gameDataConnections:hll", envelope }
    )
    assert.equal(
        await invoke(panelBot.passwordEnvelope, ctx, {
            guildId: "200000000000000099",
            panelId: on.id,
        }),
        null
    )
    // null removes the password.
    await invoke(panels.setServer, ctx, {
        ...dashboard,
        connectionId: "gameDataConnections:hll",
        password: null,
    })
    assert.equal(
        await invoke(panelBot.passwordEnvelope, ctx, {
            guildId,
            panelId: on.id,
        }),
        null
    )
})

test("the bot's report is validated, scoped and remembers the password notice once", async (t) => {
    const { ctx, dashboard } = fixture(t)
    const saved = await invoke(panels.save, ctx, {
        ...dashboard,
        panelId: null,
        settings: serverPanel,
        send: true,
        expectedRevision: null,
    })
    const attempt = {
        attemptAt: now,
        ok: false,
        error: {
            code: "missing_permissions",
            at: now,
            permissions: ["embed_links"],
        },
        nextAt: now + 30_000,
        dataAt: null,
        handledRequestAt: null,
        warnings: ["password_hidden_public_channel"],
        messages: 0,
    }
    await assert.rejects(
        invoke(panelBotWrites.report, ctx, {
            secret,
            guildId,
            panelId: saved.id,
            attempt: { ...attempt, detail: "DiscordAPIError: token" },
        })
    )
    await invoke(panelBotWrites.report, ctx, {
        secret,
        guildId: "200000000000000099",
        panelId: saved.id,
        attempt,
    })
    assert.ok(!ctx.db.tables.discordPanelStatus?.length)
    await invoke(panelBotWrites.report, ctx, {
        secret,
        guildId,
        panelId: saved.id,
        attempt,
        passwordNotified: true,
    })
    const status = ctx.db.tables.discordPanelStatus![0]!
    assert.equal(status.passwordNotifiedAt, now)
    await invoke(panelBotWrites.report, ctx, {
        secret,
        guildId,
        panelId: saved.id,
        attempt: { ...attempt, attemptAt: now + 1 },
    })
    assert.equal(ctx.db.tables.discordPanelStatus![0]!.passwordNotifiedAt, now)
    const view = await invoke(panels.overview, ctx, dashboard)
    assert.equal(view.panels[0].state, "error")
    assert.deepEqual(view.panels[0].error.permissions, ["embed_links"])
    assert.deepEqual(view.panels[0].warnings, [
        "password_hidden_public_channel",
    ])
})

test("a removed panel is purged only after its messages are gone", async (t) => {
    const { ctx, dashboard } = fixture(t)
    const saved = await invoke(panels.save, ctx, {
        ...dashboard,
        panelId: null,
        settings: serverPanel,
        send: true,
        expectedRevision: null,
    })
    assert.equal(
        await invoke(panelBotWrites.purge, ctx, {
            secret,
            guildId,
            panelId: saved.id,
        }),
        false
    )
    await invoke(panels.act, ctx, {
        ...dashboard,
        panelId: saved.id,
        action: "remove",
    })
    ctx.db.seed("discordPublications", {
        _id: "discordPublications:1",
        guildId,
        key: `panel:${saved.id}`,
        channelId,
        messageId: "223456789012345678",
        pending: null,
        lastSuccessAt: now,
        retryAt: 0,
        leaseUntil: 0,
        error: null,
    })
    assert.equal(
        await invoke(panelBotWrites.purge, ctx, {
            secret,
            guildId,
            panelId: saved.id,
        }),
        false
    )
    ctx.db.tables.discordPublications![0]!.messageId = null
    assert.equal(
        await invoke(panelBotWrites.purge, ctx, {
            secret,
            guildId,
            panelId: saved.id,
        }),
        true
    )
    assert.equal(ctx.db.tables.discordPublicPanels!.length, 0)
    assert.equal(ctx.db.tables.discordPublications!.length, 0)
})

test("Z klanu hraje matches only verified Steam links of this workspace's members", async (t) => {
    const { ctx } = fixture(t)
    ctx.db.seed("platformIdentityLinks", {
        _id: "platformIdentityLinks:1",
        platform: "steam",
        platformId: "76561198000000001",
        active: true,
        discordUserId: actorFixture.subject,
    })
    ctx.db.seed("platformIdentityLinks", {
        _id: "platformIdentityLinks:2",
        platform: "steam",
        platformId: "76561198000000002",
        active: true,
        discordUserId: "300000000000000001",
    })
    assert.deepEqual(
        await invoke(panelBot.clanPlayers, ctx, {
            secret,
            guildId,
            platformIds: [
                "76561198000000001",
                "76561198000000002",
                "not-a-steam-id",
            ],
        }),
        ["76561198000000001"]
    )
})

test("the dashboard's HLL test read needs a current clan admin", async (t) => {
    const { ctx, dashboard } = fixture(t)
    const args = {
        secret,
        guildId,
        connectionId: "gameDataConnections:hll",
        actor: actorFixture,
    }
    assert.equal((await invoke(reads.reserve, ctx, args)).kind, "claimed")
    ctx.db.tables.discordMemberAccess![0]!.isAdmin = false
    ctx.db.tables.discordMemberAccess![0]!.hasDashboardAccess = false
    assert.equal(
        (await invoke(reads.reserve, ctx, { ...args, actor: dashboard.actor }))
            .kind,
        "denied"
    )
    assert.equal(
        (
            await invoke(reads.reserve, ctx, {
                ...args,
                actor: { ...actorFixture, sid: "c".repeat(43) },
            })
        ).kind,
        "denied"
    )
})

test("the bot reads each panel with its servers, join details and status, never the password", async (t) => {
    const { ctx, dashboard } = fixture(t)
    const saved = await invoke(panels.save, ctx, {
        ...dashboard,
        panelId: null,
        settings: { ...serverPanel, content: { password: true } },
        send: true,
        expectedRevision: null,
    })
    await invoke(panels.setServer, ctx, {
        ...dashboard,
        connectionId: "gameDataConnections:hll",
        address: "203.0.113.24:7777",
        password: {
            format: 1,
            keyId: "key-1",
            nonce: "A".repeat(16),
            ciphertext: "B".repeat(24),
            tag: "C".repeat(22),
        },
    })
    const rows = await invoke(publicPanels.forGuild, ctx, { secret, guildId })
    assert.equal(rows.length, 1)
    const row = rows[0]
    assert.equal(row._id, saved.id)
    assert.equal(row.draft, false)
    assert.equal(row.servers[0].connectionId, "gameDataConnections:hll")
    assert.deepEqual(row.servers[0].join, {
        slug: "vlci-1",
        address: "203.0.113.24:7777",
        joinCode: null,
        hasPassword: true,
    })
    assert.equal(row.status, null)
    assert.doesNotMatch(JSON.stringify(rows), /BBBBBBBB|key-1/)
    await assert.rejects(
        invoke(publicPanels.forGuild, ctx, { secret: "wrong", guildId })
    )
})

test("the join page shows the queue from the server panel's live read (P4-44)", async (t) => {
    const { ctx, dashboard, advance } = fixture(t)
    await invoke(panels.setServer, ctx, {
        ...dashboard,
        connectionId: "gameDataConnections:hll",
        address: "203.0.113.24:7777",
    })
    const live = hllLiveFixture()
    const at = new Date(now - 20_000).toISOString()
    live.fetchedAt = at
    live.statusAt = at
    live.status!.playerCount = 78
    live.status!.maxPlayers = 100
    live.status!.queueCount = 3
    ctx.db.seed("hllLiveCache", {
        _id: "hllLiveCache:hll",
        connectionId: "gameDataConnections:hll",
        generation: 1,
        fence: 1,
        leaseUntil: 0,
        nextAt: now,
        retainUntil: now + 3_600_000,
        dataJson: JSON.stringify(live),
    })
    const page = await invoke(panelBot.joinPage, ctx, {
        secret,
        slug: "vlci-1",
    })
    assert.equal(page.players, 78)
    assert.equal(page.capacity, 100)
    assert.equal(page.queue, 3)
    // The same read from its own payload row, the layout since the split.
    const cache = ctx.db.tables.hllLiveCache![0]!
    ctx.db.seed("hllLivePayloads", {
        _id: "hllLivePayloads:hll",
        cacheId: cache._id,
        dataJson: cache.dataJson,
    })
    delete cache.dataJson
    const split = await invoke(panelBot.joinPage, ctx, {
        secret,
        slug: "vlci-1",
    })
    assert.equal(split.queue, 3)
    // An old read, or one of another source generation, is not "now".
    advance(10 * 60_000)
    const later = await invoke(panelBot.joinPage, ctx, {
        secret,
        slug: "vlci-1",
    })
    assert.equal(later.queue, null)
    advance(-10 * 60_000)
    await ctx.db.patch("hllLiveCache:hll", { generation: 2 })
    const other = await invoke(panelBot.joinPage, ctx, {
        secret,
        slug: "vlci-1",
    })
    assert.equal(other.queue, null)
})
