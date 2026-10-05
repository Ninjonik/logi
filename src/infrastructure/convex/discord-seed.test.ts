import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import { boardSeedSettings } from "../testing/in-memory-seed"
import * as dashboard from "../../../convex/discordSeed"
import { invoke, testContext } from "./testing/database"
import * as tick from "../../../convex/discordSeedTick"
import * as bot from "../../../convex/discordSeedBot"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const GUILD = "guild-a"
const CONNECTION = "gameDataConnections:vlci1"
const ROLE = "333333333333333333"
const CONTROL = "222222222222222222"
// Monday 2026-10-05 17:01 in Prague: the Po–Pá 17:00 slot is due.
const SLOT = Date.parse("2026-10-05T15:01:00Z")

function setup(t: TestContext, players = 12) {
    let clock = SLOT
    t.mock.method(Date, "now", () => clock)
    const ctx = testContext()
    seedDashboardActor(ctx.db, GUILD)
    for (const access of ctx.db.tables.discordMemberAccess) access.roleIds = []
    ctx.db.seed("gameDataSources", {
        _id: "gameDataSources:vlci1",
        ref: "vlci1",
        guildId: GUILD,
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        providerServerId: "1",
        origin: "https://crcon.example",
        secretRef: null,
        allowedAddresses: [],
        credentialMode: "encrypted",
        displayName: "Vlci #1 · Public",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        updatedBy: actorFixture.subject,
    })
    const observe = (count: number) =>
        ctx.db.seed("gameDataConnections", {
            _id: CONNECTION,
            sourceRef: "vlci1",
            guildId: GUILD,
            gameId: "hell_let_loose",
            provider: "hll_crcon",
            enabled: true,
            errorCategory: null,
            observation: {
                observedAt: new Date(clock - 30_000).toISOString(),
                providerUpdatedAt: null,
                displayName: "[CZ] Vlci #1 | Public",
                state: "online",
                map: "Foy",
                players: count,
                capacity: 100,
                providerInstanceId: null,
                scores: [],
                capabilities: [],
            },
        })
    observe(players)
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:a",
        guildId: GUILD,
        timezone: "Europe/Prague",
    })
    for (const [userId, roleIds] of [
        ["100000000000000101", [ROLE]],
        ["100000000000000102", [ROLE, "444444444444444444"]],
        ["100000000000000103", []],
    ] as const)
        ctx.db.seed("discordMemberAccess", {
            _id: `access:${userId}`,
            guildId: GUILD,
            userId,
            roleIds: [...roleIds],
            isAdmin: false,
            hasDashboardAccess: false,
        })
    return {
        ctx,
        advance(minutes: number, count?: number) {
            clock += minutes * 60_000
            if (count !== undefined) {
                ctx.db.tables.gameDataConnections = []
                observe(count)
            }
        },
        now: () => clock,
    }
}

const actorArgs = { secret, guildId: GUILD, actor: actorFixture }
const settings = boardSeedSettings({
    controlChannelId: CONTROL,
    seedRoleId: ROLE,
})

async function savedPlan(ctx: ReturnType<typeof setup>["ctx"]) {
    const result = await invoke(dashboard.savePlan, ctx, {
        ...actorArgs,
        connectionId: CONNECTION,
        expectedRevision: null,
        settings,
    })
    assert.deepEqual(result, { status: "saved", revision: 1 })
}

test("every seed function refuses a caller without the internal secret", async (t) => {
    const { ctx } = setup(t)
    const wrong = "wrong-secret"
    const calls: Array<[unknown, Record<string, unknown>]> = [
        [dashboard.dashboard, { ...actorArgs, secret: wrong }],
        [
            dashboard.savePlan,
            {
                ...actorArgs,
                secret: wrong,
                connectionId: CONNECTION,
                expectedRevision: null,
                settings,
            },
        ],
        [
            dashboard.startNow,
            {
                ...actorArgs,
                secret: wrong,
                connectionId: CONNECTION,
                requestKey: "request-0001",
            },
        ],
        [
            dashboard.stopNow,
            { ...actorArgs, secret: wrong, connectionId: CONNECTION },
        ],
        [bot.deliveryState, { secret: wrong, guildId: GUILD }],
        [
            bot.recordDelivery,
            {
                secret: wrong,
                guildId: GUILD,
                kind: "call",
                key: "x",
                revision: 1,
            },
        ],
        [bot.roleOffer, { secret: wrong, guildId: GUILD, roleId: ROLE }],
        [
            bot.recordCallPosted,
            { secret: wrong, guildId: GUILD, runId: "x", pingedMembers: 1 },
        ],
        [
            bot.reportCallFailed,
            {
                secret: wrong,
                guildId: GUILD,
                runId: "x",
                reason: "channel_unavailable",
            },
        ],
        [
            bot.startFromDiscord,
            {
                secret: wrong,
                guildId: GUILD,
                connectionId: CONNECTION,
                discordUserId: actorFixture.subject,
                displayName: "Admin",
                channelId: CONTROL,
                interactionId: "123456789012345678",
            },
        ],
        [
            bot.stopFromDiscord,
            {
                secret: wrong,
                guildId: GUILD,
                connectionId: CONNECTION,
                discordUserId: actorFixture.subject,
                displayName: "Admin",
                channelId: CONTROL,
            },
        ],
        [bot.panelStates, { secret: wrong, guildId: GUILD }],
    ]
    for (const [fn, args] of calls)
        await assert.rejects(invoke(fn, ctx, args), /Unauthorized/)
})

test("dashboard functions need a live clan-admin session", async (t) => {
    const { ctx } = setup(t)
    const stranger = { ...actorFixture, sid: "b".repeat(43) }
    await assert.rejects(
        invoke(dashboard.dashboard, ctx, { ...actorArgs, actor: stranger }),
        /Forbidden/
    )
    await assert.rejects(
        invoke(dashboard.startNow, ctx, {
            ...actorArgs,
            guildId: "guild-b",
            connectionId: CONNECTION,
            requestKey: "request-0001",
        }),
        /Forbidden/
    )
    assert.equal(ctx.db.tables.discordSeedRuns?.length ?? 0, 0)
})

test("an admin reads the tabs, saves a revision-fenced plan and sees role members", async (t) => {
    const { ctx } = setup(t)
    const before = await invoke(dashboard.dashboard, ctx, actorArgs)
    assert.deepEqual(before.servers, [
        {
            connectionId: CONNECTION,
            gameId: "hell_let_loose",
            name: "Vlci #1 · Public",
        },
    ])
    assert.equal(before.selected.configured, false)
    assert.equal(before.selected.status.players, 12)
    assert.equal(before.selected.status.serverStatus, "below_start")

    await savedPlan(ctx)
    assert.deepEqual(
        ctx.db.tables.discordSeedMessages.map((row) => [row.kind, row.key]),
        [
            ["control", CONNECTION],
            ["intro", settings.seedChannelId],
        ]
    )
    const after = await invoke(dashboard.dashboard, ctx, {
        ...actorArgs,
        connectionId: CONNECTION,
    })
    assert.equal(after.selected.configured, true)
    assert.equal(after.selected.revision, 1)
    assert.equal(after.selected.roleMembers, 2)
    assert.equal(
        after.selected.status.nextScheduledAt,
        "2026-10-06T15:00:00.000Z"
    )
    assert.equal(
        ctx.db.tables.discordSeedPlans[0].updatedBy,
        actorFixture.subject
    )

    assert.deepEqual(
        await invoke(dashboard.savePlan, ctx, {
            ...actorArgs,
            connectionId: CONNECTION,
            expectedRevision: null,
            settings,
        }),
        { status: "conflict", revision: 1 }
    )
    assert.deepEqual(
        await invoke(dashboard.savePlan, ctx, {
            ...actorArgs,
            connectionId: CONNECTION,
            expectedRevision: 1,
            settings: { ...settings, startBelow: 45 },
        }),
        {
            status: "invalid",
            issues: [
                { path: "startBelow", code: "start_below_not_under_live" },
            ],
        }
    )
})

test("a server of another clan can get no plan and has no dashboard", async (t) => {
    const { ctx } = setup(t)
    ctx.db.tables.gameDataConnections[0].guildId = "guild-b"
    assert.deepEqual(
        await invoke(dashboard.savePlan, ctx, {
            ...actorArgs,
            connectionId: CONNECTION,
            expectedRevision: null,
            settings,
        }),
        { status: "not_found" }
    )
    const view = await invoke(dashboard.dashboard, ctx, {
        ...actorArgs,
        connectionId: CONNECTION,
    })
    assert.deepEqual(view, { servers: [], selected: null })
})

test("Seed teď starts once per request and Ukončit seed ends it with history", async (t) => {
    const { ctx, advance } = setup(t)
    await savedPlan(ctx)
    const started = await invoke(dashboard.startNow, ctx, {
        ...actorArgs,
        connectionId: CONNECTION,
        requestKey: "request-0001",
    })
    assert.equal(started.status, "started")
    assert.equal(started.channelId, settings.seedChannelId)
    assert.equal(started.pinged, true)
    assert.deepEqual(
        await invoke(dashboard.startNow, ctx, {
            ...actorArgs,
            connectionId: CONNECTION,
            requestKey: "request-0001",
        }),
        { status: "duplicate", runId: started.runId }
    )
    assert.deepEqual(
        await invoke(dashboard.startNow, ctx, {
            ...actorArgs,
            connectionId: CONNECTION,
            requestKey: "request-0002",
        }),
        { status: "running", runId: started.runId }
    )
    await assert.rejects(
        invoke(dashboard.startNow, ctx, {
            ...actorArgs,
            connectionId: CONNECTION,
            requestKey: "x",
        }),
        /Invalid request/
    )
    advance(25)
    assert.deepEqual(
        await invoke(dashboard.stopNow, ctx, {
            ...actorArgs,
            connectionId: CONNECTION,
        }),
        { status: "stopped", runId: started.runId }
    )
    const view = await invoke(dashboard.dashboard, ctx, {
        ...actorArgs,
        connectionId: CONNECTION,
    })
    const [entry] = view.selected.history.entries
    assert.equal(entry.outcome, "admin")
    assert.equal(entry.durationMinutes, 25)
    assert.deepEqual(entry.trigger, {
        kind: "manual",
        actorName: "Fixture admin",
        via: "web",
        channelId: null,
    })
    assert.equal(view.selected.status.cooldownUntil !== null, true)
    assert.equal(JSON.stringify(view).includes(actorFixture.subject), false)
})

test("the cron fans out per plan and a scheduled seed starts exactly once", async (t) => {
    const { ctx } = setup(t, 11)
    await savedPlan(ctx)
    assert.equal(await invoke(tick.evaluate, ctx), 1)
    assert.equal(ctx.scheduler.calls.length, 1)
    const [, , args] = ctx.scheduler.calls[0] as [
        number,
        unknown,
        { planId: string },
    ]
    const first = await invoke(tick.evaluatePlan, ctx, args)
    assert.equal(first.kind, "started")
    assert.equal(first.trigger, "schedule")
    assert.deepEqual(await invoke(tick.evaluatePlan, ctx, args), {
        kind: "idle",
    })
    assert.equal(ctx.db.tables.discordSeedRuns.length, 1)
    const run = ctx.db.tables.discordSeedRuns[0]
    assert.equal(run.status, "seeding")
    assert.deepEqual(run.ping, { kind: "role", roleId: ROLE })
    assert.equal(run.serverName, "Vlci #1 · Public")
    assert.equal(
        ctx.db.tables.discordSeedPlans[0].state.consumedOccurrence,
        "2026-10-05T17:00"
    )
})

test("the panel's own pause flag pauses scheduled seeds; legacy rows read their switch", async (t) => {
    const cases: Array<[Record<string, unknown>, boolean]> = [
        [{ enabled: true, paused: true }, true],
        [{ enabled: false, paused: false }, false],
        [{ enabled: false }, true],
        [{ enabled: true }, false],
        [{ enabled: true, paused: true, draft: true }, false],
        [{ enabled: true, paused: true, removing: true }, false],
        [{ enabled: true, paused: true, kind: "results" }, false],
        [{ enabled: true, paused: true, kind: "scoreboard" }, true],
    ]
    for (const [panel, paused] of cases) {
        const { ctx } = setup(t, 11)
        await savedPlan(ctx)
        ctx.db.seed("discordPublicPanels", {
            _id: "discordPublicPanels:vlci1",
            guildId: GUILD,
            connectionId: CONNECTION,
            kind: "server",
            ...panel,
        })
        const planId = ctx.db.tables.discordSeedPlans[0]._id
        const result = await invoke(tick.evaluatePlan, ctx, { planId })
        assert.equal(
            result.kind === "skipped" && result.reason === "paused",
            paused,
            JSON.stringify(panel)
        )
    }
})

test("the bot gets everything to draw the call, the control message and the intro", async (t) => {
    const { ctx, advance } = setup(t, 11)
    await savedPlan(ctx)
    ctx.db.seed("discordPublicPanels", {
        _id: "discordPublicPanels:vlci1",
        guildId: GUILD,
        connectionId: CONNECTION,
        kind: "server",
        channelId: "555555555555555555",
        enabled: true,
        paused: false,
    })
    const planId = ctx.db.tables.discordSeedPlans[0]._id
    await invoke(tick.evaluatePlan, ctx, { planId })
    const runId = ctx.db.tables.discordSeedRuns[0]._id

    const state = await invoke(bot.deliveryState, ctx, {
        secret,
        guildId: GUILD,
    })
    assert.equal(state.servers.length, 1)
    const server = state.servers[0]
    assert.equal(server.activeRun.id, runId)
    assert.equal(server.status, "below_start")
    assert.equal(server.name, "Vlci #1 · Public")
    assert.equal(server.gameId, "hell_let_loose")
    assert.equal(server.snapshot.map, "Foy")
    assert.deepEqual(server.panel, {
        channelId: "555555555555555555",
        paused: false,
        sent: true,
    })
    assert.deepEqual(server.control.outbox, {
        revision: 2,
        deliveredRevision: 0,
    })
    assert.equal(server.control.message, null)
    assert.equal(state.calls.length, 1)
    assert.equal(state.calls[0].run.id, runId)
    assert.deepEqual(state.calls[0].outbox, {
        revision: 1,
        deliveredRevision: 0,
    })
    assert.equal(state.intros.length, 1)
    assert.equal(state.intros[0].channelId, settings.seedChannelId)
    assert.equal(state.intros[0].show, true)
    assert.equal(state.intros[0].roleId, ROLE)
    assert.deepEqual(state.intros[0].servers, [
        { name: "Vlci #1 · Public", schedule: settings.schedule },
    ])

    // The bot published the call through the shared managed publications.
    ctx.db.seed("discordPublications", {
        _id: "discordPublications:call",
        guildId: GUILD,
        key: `seed:call:${runId}`,
        channelId: settings.seedChannelId,
        messageId: "999999999999999999",
    })
    assert.equal(
        await invoke(bot.recordDelivery, ctx, {
            secret,
            guildId: GUILD,
            kind: "call",
            key: runId,
            revision: 1,
        }),
        true
    )
    assert.equal(
        await invoke(bot.recordCallPosted, ctx, {
            secret,
            guildId: GUILD,
            runId,
            pingedMembers: 34,
        }),
        "recorded"
    )
    assert.equal(ctx.db.tables.discordSeedRuns[0].pingedMembers, 34)
    assert.deepEqual(
        await invoke(bot.panelStates, ctx, { secret, guildId: GUILD }),
        [
            {
                connectionId: CONNECTION,
                runId,
                startedAt: SLOT,
                liveFrom: 40,
                call: {
                    channelId: settings.seedChannelId,
                    messageId: "999999999999999999",
                },
            },
        ]
    )

    // Live at 41 players: the run ends and the final edit stays requested
    // until the bot records it.
    advance(30, 41)
    const live = await invoke(tick.evaluatePlan, ctx, { planId })
    assert.equal(live.status, "live")
    const after = await invoke(bot.deliveryState, ctx, {
        secret,
        guildId: GUILD,
    })
    assert.equal(after.servers[0].activeRun, null)
    assert.equal(after.calls.length, 1)
    assert.equal(after.calls[0].run.status, "live")
    assert.deepEqual(after.calls[0].message, {
        channelId: settings.seedChannelId,
        messageId: "999999999999999999",
    })
    await invoke(bot.recordDelivery, ctx, {
        secret,
        guildId: GUILD,
        kind: "call",
        key: runId,
        revision: after.calls[0].outbox.revision,
    })
    const done = await invoke(bot.deliveryState, ctx, {
        secret,
        guildId: GUILD,
    })
    assert.deepEqual(done.calls, [])
    assert.deepEqual(
        await invoke(bot.panelStates, ctx, { secret, guildId: GUILD }),
        []
    )
    assert.equal(
        await invoke(bot.recordDelivery, ctx, {
            secret,
            guildId: GUILD,
            kind: "call",
            key: "unknown",
            revision: 1,
        }),
        false
    )
})

test("a failed delivery attempt is kept for the retry, not marked delivered", async (t) => {
    const { ctx } = setup(t, 11)
    await savedPlan(ctx)
    await invoke(bot.recordDelivery, ctx, {
        secret,
        guildId: GUILD,
        kind: "control",
        key: CONNECTION,
        revision: 1,
        error: "Missing Permissions",
    })
    const row = ctx.db.tables.discordSeedMessages.find(
        (entry) => entry.kind === "control"
    )!
    assert.equal(row.deliveredRevision, 0)
    assert.equal(row.error, "Missing Permissions")
})

test("Zvát mě na seed works only for a role a plan offers", async (t) => {
    const { ctx } = setup(t)
    await savedPlan(ctx)
    assert.deepEqual(
        await invoke(bot.roleOffer, ctx, {
            secret,
            guildId: GUILD,
            roleId: ROLE,
        }),
        { offered: true, seedChannelId: settings.seedChannelId }
    )
    for (const [guildId, roleId] of [
        ["guild-b", ROLE],
        [GUILD, "444444444444444444"],
        [GUILD, "not-a-role"],
    ])
        assert.equal(
            (await invoke(bot.roleOffer, ctx, { secret, guildId, roleId }))
                .offered,
            false
        )
    ctx.db.tables.discordSeedPlans[0].settings.roleSelfService = false
    assert.equal(
        (
            await invoke(bot.roleOffer, ctx, {
                secret,
                guildId: GUILD,
                roleId: ROLE,
            })
        ).offered,
        false
    )
})

test("a failed delivery fails the run and frees the server", async (t) => {
    const { ctx } = setup(t, 11)
    await savedPlan(ctx)
    const planId = ctx.db.tables.discordSeedPlans[0]._id
    await invoke(tick.evaluatePlan, ctx, { planId })
    const runId = ctx.db.tables.discordSeedRuns[0]._id
    assert.equal(
        await invoke(bot.reportCallFailed, ctx, {
            secret,
            guildId: "guild-b",
            runId,
            reason: "channel_unavailable",
        }),
        "not_found"
    )
    assert.equal(
        await invoke(bot.reportCallFailed, ctx, {
            secret,
            guildId: GUILD,
            runId,
            reason: "channel_unavailable",
        }),
        "recorded"
    )
    assert.equal(ctx.db.tables.discordSeedRuns[0].status, "failed")
    assert.equal(ctx.db.tables.discordSeedPlans[0].state.activeRunId, null)
})

test("Discord buttons work only for Logi admins of the clan", async (t) => {
    const { ctx } = setup(t)
    await savedPlan(ctx)
    const button = {
        secret,
        guildId: GUILD,
        connectionId: CONNECTION,
        displayName: "Hráč 02",
        channelId: CONTROL,
    }
    assert.deepEqual(
        await invoke(bot.startFromDiscord, ctx, {
            ...button,
            discordUserId: "100000000000000101",
            interactionId: "123456789012345601",
        }),
        { status: "forbidden" }
    )
    assert.equal(ctx.db.tables.discordSeedRuns?.length ?? 0, 0)
    const started = await invoke(bot.startFromDiscord, ctx, {
        ...button,
        discordUserId: actorFixture.subject,
        interactionId: "123456789012345602",
    })
    assert.equal(started.status, "started")
    const run = ctx.db.tables.discordSeedRuns[0]
    assert.deepEqual(run.trigger, {
        kind: "manual",
        actor: { id: actorFixture.subject, name: "Fixture admin" },
        via: "discord",
        channelId: CONTROL,
    })
    assert.deepEqual(
        await invoke(bot.stopFromDiscord, ctx, {
            ...button,
            discordUserId: "100000000000000101",
        }),
        { status: "forbidden" }
    )
    assert.deepEqual(
        await invoke(bot.stopFromDiscord, ctx, {
            ...button,
            discordUserId: actorFixture.subject,
        }),
        { status: "stopped", runId: run._id }
    )
    await assert.rejects(
        invoke(bot.startFromDiscord, ctx, {
            ...button,
            discordUserId: actorFixture.subject,
            interactionId: "not-a-snowflake",
        }),
        /Invalid interaction/
    )
})
