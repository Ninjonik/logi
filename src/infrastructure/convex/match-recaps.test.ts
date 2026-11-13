import * as delivery from "../../../convex/matchRecapDelivery"
import { invoke, testContext } from "./testing/database"
import * as recaps from "../../../convex/matchRecaps"
import * as players from "../../../convex/players"
import assert from "node:assert/strict"
import test from "node:test"

const secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")
const eventId = "events:recap"
const discordUserId = "222222222222222222"
function fixture(userId = "imported-player") {
    const ctx = testContext()
    ctx.db.seed("events", {
        _id: eventId,
        guildId: "guilds:a",
        name: "Synthetic match",
        eventResult: {},
    })
    ctx.db.seed("users", {
        _id: "users:player",
        id: "imported-player",
        discordId: discordUserId,
    })
    ctx.db.seed("rosters", {
        _id: "rosters:a",
        eventId,
        squads: [{ players: [{ id: userId }] }],
    })
    ctx.db.seed("playerStats", {
        _id: "playerStats:a",
        userId,
        matches: {
            [eventId]: {
                kills: 4,
                deaths: 2,
                killDeathRatio: 2,
                mapName: "Foy",
            },
        },
    })
    return ctx
}
const queue = (ctx: ReturnType<typeof fixture>) =>
    invoke(recaps.queueForPublishedResult, ctx, {
        secret,
        eventId,
        baselines: [],
    })
const list = (ctx: ReturnType<typeof fixture>) =>
    invoke(recaps.listPendingForEvent, ctx, {
        secret,
        eventId,
        deliveryVersion: 3,
    })

test("recap send boundary survives a lost success receipt and rejects stale acknowledgments", async (t) => {
    const now = Date.parse("2026-11-13T10:00:00Z")
    t.mock.timers.enable({ apis: ["Date"], now })
    const ctx = fixture()
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:recap",
        guildId: "guilds:a",
    })
    await queue(ctx)
    const [candidate] = await list(ctx)
    const args = { secret, recapId: candidate.recapId, eventId, discordUserId }
    const first = await invoke(delivery.claim, ctx, args)
    assert.ok(first.token)
    assert.equal(await invoke(delivery.claim, ctx, args), null)
    await invoke(delivery.begin, ctx, {
        secret,
        recapId: candidate.recapId,
        token: first.token,
    })
    // Discord accepted the message, but neither success nor failure was recorded.
    t.mock.timers.setTime(now + 300_001)
    await invoke(delivery.due, ctx, { secret })
    assert.equal(ctx.db.tables.matchRecaps[0].deliveryState, "uncertain")
    assert.deepEqual(await list(ctx), [])
    assert.equal(await invoke(delivery.claim, ctx, args), null)
    assert.deepEqual(
        await invoke(recaps.markSent, ctx, {
            ...args,
            deliveryToken: first.token,
        }),
        { ok: false }
    )
    assert.deepEqual(
        (
            await invoke(delivery.inspect, ctx, {
                secret,
                guildId: "guilds:a",
                eventId,
                cursor: null,
            })
        ).page[0].receipt,
        "uncertain"
    )
    await assert.rejects(
        invoke(delivery.reconcile, ctx, {
            secret,
            guildId: "other",
            recapId: candidate.recapId,
            operator: "operator",
            evidence: "Actual Discord confirmation",
            action: "confirm",
        }),
        /not found/
    )
    await invoke(delivery.reconcile, ctx, {
        secret,
        guildId: "guilds:a",
        recapId: candidate.recapId,
        operator: "operator",
        evidence: "Verified the actual Discord message",
        action: "confirm",
        messageId: "100000000000000002",
    })
    assert.equal(ctx.db.tables.matchRecaps[0].deliveryState, "confirmed")
    assert.equal(ctx.db.tables.matchRecapDeliveryAudits.length, 1)
})

test("pre-send recap crash backs off, fences the old owner and rechecks an opt-out before sending", async (t) => {
    const now = Date.parse("2026-11-13T10:00:00Z")
    t.mock.timers.enable({ apis: ["Date"], now })
    const ctx = fixture()
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:recap",
        guildId: "guilds:a",
    })
    await queue(ctx)
    const [candidate] = await list(ctx)
    const args = { secret, recapId: candidate.recapId, eventId, discordUserId }
    const first = await invoke(delivery.claim, ctx, args)
    t.mock.timers.setTime(now + 300_001)
    await invoke(delivery.due, ctx, { secret })
    assert.equal(ctx.db.tables.matchRecaps[0].deliveryState, "ready")
    assert.equal(await invoke(delivery.claim, ctx, args), null)
    t.mock.timers.setTime(now + 360_002)
    const second = await invoke(delivery.claim, ctx, args)
    assert.notEqual(first.token, second.token)
    assert.deepEqual(
        await invoke(delivery.begin, ctx, {
            secret,
            recapId: candidate.recapId,
            token: first.token,
        }),
        { ok: false }
    )
    ctx.db.tables.users[0].matchRecapNotificationsEnabled = false
    assert.deepEqual(
        await invoke(delivery.begin, ctx, {
            secret,
            recapId: candidate.recapId,
            token: second.token,
        }),
        { ok: false }
    )
    assert.equal(ctx.db.tables.matchRecaps[0].deliveryState, "ready")
})

test("recap pre-send retries stop after five attempts and legacy rows never enter automatic delivery", async (t) => {
    const now = Date.parse("2026-11-13T10:00:00Z")
    t.mock.timers.enable({ apis: ["Date"], now })
    const ctx = fixture()
    await queue(ctx)
    const [candidate] = await list(ctx)
    const args = { secret, recapId: candidate.recapId, eventId, discordUserId }
    for (let attempt = 1; attempt <= 5; attempt++) {
        const claimed = await invoke(delivery.claim, ctx, args)
        assert.ok(claimed?.token)
        await invoke(delivery.fail, ctx, {
            secret,
            recapId: candidate.recapId,
            token: claimed.token,
            outcome: "pre_send",
        })
        if (attempt < 5)
            t.mock.timers.setTime(ctx.db.tables.matchRecaps[0].deliveryDueAt)
    }
    assert.equal(ctx.db.tables.matchRecaps[0].deliveryState, "failed")
    delete ctx.db.tables.matchRecaps[0].deliveryState
    assert.deepEqual(await list(ctx), [])
    assert.equal(await invoke(delivery.claim, ctx, args), null)
    assert.deepEqual(
        await invoke(recaps.listPendingForEvent, ctx, {
            secret,
            eventId,
            deliveryVersion: 2,
        }),
        []
    )
})

test("recap queue validator accepts optional nullable cash baselines from captureBaselines", () => {
    const mutation = recaps.queueForPublishedResult
    assert.ok(
        "exportArgs" in mutation && typeof mutation.exportArgs === "function"
    )
    const args = JSON.parse(mutation.exportArgs())
    assert.deepEqual(args.value.baselines.fieldType.value.value.cashDelta, {
        fieldType: {
            type: "union",
            value: [{ type: "number" }, { type: "null" }],
        },
        optional: true,
    })
})

test("recap discovery is bounded and defers blocked rows without hiding a different event", async (t) => {
    const now = Date.parse("2026-11-13T10:00:00Z")
    t.mock.timers.enable({ apis: ["Date"], now })
    const ctx = fixture()
    for (let index = 0; index < 12; index++)
        ctx.db.seed("matchRecaps", {
            _id: `matchRecaps:blocked${index}`,
            eventId,
            status: "pending",
            deliveryState: "ready",
            deliveryDueAt: now,
        })
    ctx.db.seed("matchRecaps", {
        _id: "matchRecaps:next",
        eventId: "events:next",
        status: "pending",
        deliveryState: "ready",
        deliveryDueAt: now,
    })
    assert.deepEqual(await invoke(delivery.due, ctx, { secret }), [eventId])
    await invoke(delivery.deferEvent, ctx, { secret, eventId })
    assert.deepEqual(await invoke(delivery.due, ctx, { secret }), [
        "events:next",
    ])
    await assert.rejects(
        invoke(delivery.due, ctx, { secret: "wrong" }),
        /Unauthorized/
    )
})

for (const cashDelta of [undefined, null, 125] as const) {
    test(`captured recap baseline round-trips through the queue with cashDelta ${cashDelta}`, async () => {
        const ctx = fixture()
        const current = ctx.db.tables.playerStats[0].matches[eventId]
        delete ctx.db.tables.playerStats[0].matches[eventId]
        ctx.db.tables.playerStats[0].matches.previous = {
            importedAt: "2026-10-17T18:00:00.000Z",
            kills: 35.8,
            deaths: 54.7,
            killDeathRatio: 0.6586666666666667,
            ...(cashDelta === undefined ? {} : { cashDelta }),
        }
        const baselines = await invoke(recaps.captureBaselines, ctx, {
            secret,
            userIds: ["imported-player"],
        })
        ctx.db.tables.playerStats[0].matches[eventId] = current
        assert.deepEqual(
            await invoke(recaps.queueForPublishedResult, ctx, {
                secret,
                eventId,
                baselines,
            }),
            { queued: 1 }
        )
        const { userId: _userId, ...expected } = baselines[0]
        assert.equal(_userId, "imported-player")
        assert.deepEqual(ctx.db.tables.matchRecaps[0].previousTen, expected)
        assert.equal(expected.cashDelta, cashDelta)
    })
}

test("recap queue binds imported players to an explicit Discord account and record", async () => {
    const ctx = fixture()
    assert.deepEqual(await queue(ctx), { queued: 1 })
    const row = ctx.db.tables.matchRecaps[0]
    assert.equal(row.userId, "imported-player")
    assert.equal(row.userRecordId, "users:player")
    assert.equal(row.discordUserId, discordUserId)
    const [delivery] = await list(ctx)
    assert.equal(delivery.userId, "imported-player")
    assert.equal(delivery.discordUserId, discordUserId)
    assert.equal(delivery.recapId, row._id)
})

test("numeric imported IDs without an explicit Discord link cannot receive recaps", async () => {
    const ctx = fixture(discordUserId)
    ctx.db.tables.users[0].id = discordUserId
    delete ctx.db.tables.users[0].discordId
    assert.deepEqual(await queue(ctx), { queued: 0 })
    assert.deepEqual(await list(ctx), [])
})

test("opt-out also blocks a queued player referenced by their Discord alias", async () => {
    const ctx = fixture(discordUserId)
    await queue(ctx)
    ctx.db.tables.users[0].matchRecapNotificationsEnabled = false
    assert.deepEqual(await list(ctx), [])
    const fresh = fixture(discordUserId)
    fresh.db.tables.users[0].matchRecapNotificationsEnabled = false
    assert.deepEqual(await queue(fresh), { queued: 0 })
})

for (const change of ["unlink", "relink", "replace", "opt_out"] as const) {
    test(`pending recap is withheld after ${change}`, async () => {
        const ctx = fixture()
        await queue(ctx)
        const user = ctx.db.tables.users[0]
        if (change === "unlink") delete user.discordId
        if (change === "relink") user.discordId = "333333333333333333"
        if (change === "replace") user._id = "users:replacement"
        if (change === "opt_out") user.matchRecapNotificationsEnabled = false
        assert.deepEqual(await list(ctx), [])
    })
}

test("unbound legacy pending recaps are withheld instead of guessing a recipient", async () => {
    const ctx = fixture()
    ctx.db.seed("matchRecaps", {
        _id: "matchRecaps:legacy",
        eventId,
        userId: "imported-player",
        status: "pending",
    })
    assert.deepEqual(await list(ctx), [])
})

for (const field of ["isDraft", "sharedAccessRevoked"] as const) {
    test(`recap recovery withholds a queued event after ${field}`, async () => {
        const ctx = fixture()
        await queue(ctx)
        ctx.db.tables.events[0][field] = true
        assert.deepEqual(await list(ctx), [])
    })
}

test("notification preference resolves the authenticated Discord subject, not a colliding imported ID", async () => {
    const ctx = fixture()
    ctx.db.seed("users", {
        _id: "users:unrelated",
        id: discordUserId,
        discordId: "333333333333333333",
        matchRecapNotificationsEnabled: true,
    })
    await invoke(players.setMatchRecapNotifications, ctx, {
        secret,
        userId: discordUserId,
        enabled: false,
    })
    assert.equal(ctx.db.tables.users[0].matchRecapNotificationsEnabled, false)
    assert.equal(ctx.db.tables.users[1].matchRecapNotificationsEnabled, true)
})

test("old delivery clients receive no queue and cannot interpret player IDs as Discord IDs", async () => {
    const ctx = fixture()
    await queue(ctx)
    assert.deepEqual(
        await invoke(recaps.listPendingForEvent, ctx, { secret, eventId }),
        []
    )
    assert.equal((await list(ctx)).length, 1)
    assert.deepEqual(await queue(ctx), { queued: 0 })
})

test("delivery preparation checks event, recipient, opt-out and sent state independently of an earlier list", async () => {
    const ctx = fixture()
    await queue(ctx)
    const [candidate] = await list(ctx)
    const args = {
        secret,
        eventId,
        recapId: candidate.recapId,
        discordUserId,
        deliveryVersion: 3,
    }
    assert.equal(
        (await invoke(recaps.prepareDelivery, ctx, args)).userId,
        "imported-player"
    )
    assert.equal(
        await invoke(recaps.prepareDelivery, ctx, {
            ...args,
            eventId: "events:other",
        }),
        null
    )
    assert.equal(
        await invoke(recaps.prepareDelivery, ctx, {
            ...args,
            discordUserId: "333333333333333333",
        }),
        null
    )
    ctx.db.tables.users[0].matchRecapNotificationsEnabled = false
    assert.equal(await invoke(recaps.prepareDelivery, ctx, args), null)
    ctx.db.tables.users[0].matchRecapNotificationsEnabled = true
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:recap",
        guildId: "guilds:a",
    })
    const claim = await invoke(delivery.claim, ctx, args)
    assert.ok(claim?.token)
    await invoke(delivery.begin, ctx, {
        secret,
        recapId: candidate.recapId,
        token: claim.token,
    })
    await invoke(recaps.markSent, ctx, {
        secret,
        recapId: candidate.recapId,
        discordUserId: "333333333333333333",
    })
    assert.equal(ctx.db.tables.matchRecaps[0].status, "pending")
    await invoke(recaps.markSent, ctx, {
        secret,
        recapId: candidate.recapId,
        discordUserId,
        deliveryToken: claim.token,
    })
    assert.equal(ctx.db.tables.matchRecaps[0].status, "sent")
    assert.equal(await invoke(recaps.prepareDelivery, ctx, args), null)
    assert.deepEqual(await list(ctx), [])
    await assert.rejects(
        invoke(recaps.prepareDelivery, ctx, { ...args, secret: "wrong" }),
        /Unauthorized/
    )
})

test("a numeric imported account cannot change notification preferences without an explicit Discord link", async () => {
    const ctx = fixture(discordUserId)
    ctx.db.tables.users[0].id = discordUserId
    delete ctx.db.tables.users[0].discordId
    await assert.rejects(
        invoke(players.setMatchRecapNotifications, ctx, {
            secret,
            userId: discordUserId,
            enabled: true,
        }),
        /not found/
    )
    assert.equal(
        ctx.db.tables.users[0].matchRecapNotificationsEnabled,
        undefined
    )
})
