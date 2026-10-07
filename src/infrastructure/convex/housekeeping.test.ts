import {
    pruneHistory,
    removeWebhookDeliveries,
} from "../../../convex/housekeeping"
import { invoke, spyReads, testContext } from "./testing/database"
import { remove } from "../../../convex/webhooks"
import { getFunctionName } from "convex/server"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()
const ago = (days: number) => now - days * DAY
const isoAgo = (days: number) => new Date(ago(days)).toISOString()

type Ctx = ReturnType<typeof testContext>
const ids = (ctx: Ctx, table: string) =>
    (ctx.db.tables[table] ?? []).map((row) => row._id).sort()
const scheduled = (ctx: Ctx) =>
    ctx.scheduler.calls.map((call) => {
        const [delay, fn, args] = call as [number, never, unknown]
        return { delay, name: getFunctionName(fn), args }
    })

function delivery(
    ctx: Ctx,
    id: string,
    status: string,
    nextAttemptAt: number,
    webhookId = "webhookSubscriptions:a"
) {
    ctx.db.seed("webhookDeliveries", {
        _id: `webhookDeliveries:${id}`,
        webhookId,
        guildId: "guild-a",
        eventType: "event.updated",
        payload: "{}",
        attempt: 1,
        status,
        nextAttemptAt,
        createdAt: new Date(nextAttemptAt).toISOString(),
    })
}

function seedRun(
    ctx: Ctx,
    id: string,
    status: string,
    startedAt: number,
    outbox?: { revision: number; deliveredRevision: number }
) {
    ctx.db.seed("discordSeedRuns", {
        _id: `discordSeedRuns:${id}`,
        guildId: "guild-a",
        connectionId: "gameDataConnections:1",
        status,
        startedAt,
    })
    if (outbox)
        ctx.db.seed("discordSeedMessages", {
            _id: `discordSeedMessages:call-${id}`,
            guildId: "guild-a",
            kind: "call",
            key: `discordSeedRuns:${id}`,
            updatedAt: startedAt,
            ...outbox,
        })
}

/** Every table with rows past its window, rows inside it and rows that must stay. */
function fixture() {
    const ctx = testContext()
    ctx.db.seed("events", {
        _id: "events:past",
        guildId: "guild-a",
        gameEnd: isoAgo(40),
    })
    ctx.db.seed("events", {
        _id: "events:recent",
        guildId: "guild-a",
        gameEnd: isoAgo(5),
    })
    ctx.db.seed("events", {
        _id: "events:upcoming",
        guildId: "guild-a",
        gameEnd: new Date(now + 10 * DAY).toISOString(),
    })

    delivery(ctx, "old-delivered", "delivered", ago(31))
    delivery(ctx, "old-failed", "failed", ago(45))
    delivery(ctx, "old-pending", "pending", ago(31))
    delivery(ctx, "recent-delivered", "delivered", ago(29))

    for (const [id, days] of [
        ["old", 31],
        ["recent", 1],
    ] as const) {
        ctx.db.seed("websiteEventCommandReceipts", {
            _id: `websiteEventCommandReceipts:${id}`,
            guildId: "guild-a",
            idempotencyKey: id,
            createdAt: isoAgo(days),
        })
        ctx.db.seed("eventReminderRequests", {
            _id: `eventReminderRequests:${id}`,
            guildId: "guild-a",
            eventId: "events:past",
            status: "sent",
            requestedAt: isoAgo(days),
        })
        ctx.db.seed("automaticReminderOutcomes", {
            _id: `automaticReminderOutcomes:${id}`,
            guildId: "guild-a",
            eventId: "events:past",
            sentAt: isoAgo(days),
        })
    }

    ctx.db.seed("meetingAttendanceRequests", {
        _id: "meetingAttendanceRequests:old",
        status: "completed",
        expiresAt: isoAgo(2),
    })
    ctx.db.seed("meetingAttendanceRequests", {
        _id: "meetingAttendanceRequests:recent",
        status: "failed",
        expiresAt: new Date(now - 60 * 60_000).toISOString(),
    })
    ctx.db.seed("platformLinkChallenges", {
        _id: "platformLinkChallenges:old",
        status: "consumed",
        createdAt: ago(2) - 10 * 60_000,
        expiresAt: ago(2),
    })
    ctx.db.seed("platformLinkChallenges", {
        _id: "platformLinkChallenges:recent",
        status: "pending",
        createdAt: now - 70 * 60_000,
        expiresAt: now - 60 * 60_000,
    })

    seedRun(ctx, "delivered", "ended_timeout", ago(31), {
        revision: 3,
        deliveredRevision: 3,
    })
    seedRun(ctx, "no-call", "live", ago(40))
    seedRun(ctx, "undelivered", "failed", ago(31), {
        revision: 4,
        deliveredRevision: 3,
    })
    seedRun(ctx, "running", "seeding", ago(31))
    seedRun(ctx, "recent", "ended_admin", ago(29), {
        revision: 2,
        deliveredRevision: 2,
    })
    ctx.db.seed("discordSeedMessages", {
        _id: "discordSeedMessages:control",
        guildId: "guild-a",
        kind: "control",
        key: "gameDataConnections:1",
        revision: 9,
        deliveredRevision: 9,
        updatedAt: ago(60),
    })

    for (const [id, eventId, days] of [
        ["past", "events:past", 45],
        ["gone", "events:deleted", 31],
        ["upcoming", "events:upcoming", 31],
        ["ended-recently", "events:recent", 31],
        ["recent", "events:past", 1],
    ] as const)
        ctx.db.seed("signupActivities", {
            _id: `signupActivities:${id}`,
            guildId: "guild-a",
            eventId,
            userId: "user-1",
            action: "signed_up",
            occurredAt: isoAgo(days),
        })

    for (const [id, eventId, status, days] of [
        ["sent-past", "events:past", "sent", 45],
        ["failed-gone", "events:deleted", "failed", 31],
        ["sent-upcoming", "events:upcoming", "sent", 31],
        ["pending-past", "events:past", "pending", 45],
        ["sent-recent", "events:past", "sent", 10],
    ] as const)
        ctx.db.seed("rosterChangeRequests", {
            _id: `rosterChangeRequests:${id}`,
            guildId: "guild-a",
            eventId,
            status,
            requestedAt: isoAgo(days),
            before: [],
        })

    ctx.db.seed("leagueMessageRefs", {
        _id: "leagueMessageRefs:legacy-old",
        guildId: "guild-a",
        messageId: "1",
        matchIds: ["m1"],
        _creationTime: ago(15),
    })
    ctx.db.seed("leagueMessageRefs", {
        _id: "leagueMessageRefs:legacy-recent",
        guildId: "guild-a",
        messageId: "2",
        matchIds: ["m2"],
        _creationTime: ago(13),
    })
    ctx.db.seed("leagueMessageRefs", {
        _id: "leagueMessageRefs:expiring",
        guildId: "guild-a",
        messageId: "3",
        matchIds: ["m3"],
        expiresAt: now + DAY,
        _creationTime: ago(13),
    })
    return ctx
}

test("each table loses only the rows past its window, through an index", async () => {
    const ctx = fixture()
    const reads = spyReads(ctx)
    const result = await invoke(pruneHistory, ctx)
    assert.deepEqual(result, {
        deleted: {
            webhookDeliveries: 2,
            websiteEventCommandReceipts: 1,
            eventReminderRequests: 1,
            automaticReminderOutcomes: 1,
            meetingAttendanceRequests: 1,
            platformLinkChallenges: 1,
            discordSeedRuns: 2,
            signupActivities: 2,
            rosterChangeRequests: 2,
            leagueMessageRefs: 1,
        },
        more: false,
    })
    assert.deepEqual(
        reads.filter((read) => read.index === null),
        [],
        "no read walks a whole table"
    )
    assert.deepEqual(ctx.scheduler.calls, [])

    assert.deepEqual(ids(ctx, "webhookDeliveries"), [
        "webhookDeliveries:old-pending",
        "webhookDeliveries:recent-delivered",
    ])
    for (const table of [
        "websiteEventCommandReceipts",
        "eventReminderRequests",
        "automaticReminderOutcomes",
        "meetingAttendanceRequests",
        "platformLinkChallenges",
    ])
        assert.deepEqual(ids(ctx, table), [`${table}:recent`], table)
    // An undelivered call keeps its run for the bot; a running seed and the
    // history of the last 30 days stay; control messages are not runs.
    assert.deepEqual(ids(ctx, "discordSeedRuns"), [
        "discordSeedRuns:recent",
        "discordSeedRuns:running",
        "discordSeedRuns:undelivered",
    ])
    assert.deepEqual(ids(ctx, "discordSeedMessages"), [
        "discordSeedMessages:call-recent",
        "discordSeedMessages:call-undelivered",
        "discordSeedMessages:control",
    ])
    assert.deepEqual(ids(ctx, "signupActivities"), [
        "signupActivities:ended-recently",
        "signupActivities:recent",
        "signupActivities:upcoming",
    ])
    assert.deepEqual(ids(ctx, "rosterChangeRequests"), [
        "rosterChangeRequests:pending-past",
        "rosterChangeRequests:sent-recent",
        "rosterChangeRequests:sent-upcoming",
    ])
    assert.deepEqual(ids(ctx, "leagueMessageRefs"), [
        "leagueMessageRefs:expiring",
        "leagueMessageRefs:legacy-recent",
    ])
    // Match statistics and the events themselves are never touched.
    assert.equal(ctx.db.tables.events.length, 3)
})

test("a full batch reschedules the prune until a batch is not full", async () => {
    const ctx = testContext()
    for (let i = 0; i < 251; i++)
        ctx.db.seed("websiteEventCommandReceipts", {
            _id: `websiteEventCommandReceipts:${i}`,
            guildId: "guild-a",
            createdAt: isoAgo(31),
        })
    const first = await invoke(pruneHistory, ctx)
    assert.equal(first.deleted.websiteEventCommandReceipts, 250)
    assert.equal(first.more, true)
    assert.deepEqual(scheduled(ctx), [
        { delay: 0, name: "housekeeping:pruneHistory", args: {} },
    ])
    const second = await invoke(pruneHistory, ctx)
    assert.equal(second.deleted.websiteEventCommandReceipts, 1)
    assert.equal(second.more, false)
    assert.equal(ctx.scheduler.calls.length, 1)
    assert.deepEqual(ids(ctx, "websiteEventCommandReceipts"), [])
})

test("a full batch of rows that must stay does not reschedule", async () => {
    const ctx = testContext()
    ctx.db.seed("events", {
        _id: "events:upcoming",
        guildId: "guild-a",
        gameEnd: new Date(now + 40 * DAY).toISOString(),
    })
    for (let i = 0; i < 250; i++)
        ctx.db.seed("signupActivities", {
            _id: `signupActivities:${i}`,
            guildId: "guild-a",
            eventId: "events:upcoming",
            occurredAt: isoAgo(31),
        })
    const result = await invoke(pruneHistory, ctx)
    assert.equal(result.deleted.signupActivities, 0)
    assert.equal(result.more, false)
    assert.deepEqual(ctx.scheduler.calls, [])
    assert.equal(ctx.db.tables.signupActivities.length, 250)
})

test("removing a webhook deletes its deliveries, the rest in a scheduled continuation", async () => {
    const ctx = testContext()
    for (const [id, guildId] of [
        ["a", "guild-a"],
        ["b", "guild-a"],
    ])
        ctx.db.seed("webhookSubscriptions", {
            _id: `webhookSubscriptions:${id}`,
            guildId,
            url: "https://example.test/hook",
            eventTypes: [],
            secret: "synthetic",
            enabled: true,
        })
    for (let i = 0; i < 251; i++)
        delivery(ctx, `a-${i}`, i % 2 ? "delivered" : "pending", now)
    delivery(ctx, "b-0", "delivered", now, "webhookSubscriptions:b")

    await assert.rejects(
        invoke(remove, ctx, {
            secret,
            guildId: "guild-b",
            webhookId: "webhookSubscriptions:a",
        }),
        /Webhook not found/
    )
    assert.equal(ctx.db.tables.webhookDeliveries.length, 252)

    await invoke(remove, ctx, {
        secret,
        guildId: "guild-a",
        webhookId: "webhookSubscriptions:a",
    })
    assert.deepEqual(ids(ctx, "webhookSubscriptions"), [
        "webhookSubscriptions:b",
    ])
    assert.equal(ctx.db.tables.webhookDeliveries.length, 2)
    assert.deepEqual(scheduled(ctx), [
        {
            delay: 0,
            name: "housekeeping:removeWebhookDeliveries",
            args: { webhookId: "webhookSubscriptions:a" },
        },
    ])

    assert.deepEqual(
        await invoke(removeWebhookDeliveries, ctx, {
            webhookId: "webhookSubscriptions:a",
        }),
        { deleted: 1, more: false }
    )
    assert.equal(ctx.scheduler.calls.length, 1)
    assert.deepEqual(ids(ctx, "webhookDeliveries"), ["webhookDeliveries:b-0"])
})
