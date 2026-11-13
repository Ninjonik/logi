import {
    DurableDelivery,
    UnattemptedDelivery,
    type DeliveryOwner,
} from "../../../discord-bot/src/runtime/durable-delivery"
import {
    boardEvent,
    boardPayload,
    boardRoster,
} from "../../../discord-bot/src/events/board-example.fixture"
import {
    claim,
    acknowledge,
    retry,
    reserveSignup,
} from "../../../convex/discordScheduledDispatch"
import { processAttendanceReminders } from "../../../discord-bot/src/sync/attendance-reminders"
import {
    claimDue,
    complete as completeJob,
} from "../../../convex/scheduledJobs"
import { processSignupReminders } from "../../../discord-bot/src/sync/signup-reminders"
import { complete as completeReminder } from "../../../convex/eventReminders"
import { begin, finish, plan, reset } from "../../../convex/discordDelivery"
import type { MutationCtx } from "../../../convex/_generated/server"
import { pruneDeliveryPlans } from "../../../convex/discordDelivery"
import { recordAutomatic } from "../../../convex/eventReminders"
import { expire } from "../../../convex/discordRequestRecovery"
import { invoke, testContext } from "./testing/database"
import test, { type TestContext } from "node:test"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import type { Client } from "discord.js"
import assert from "node:assert/strict"

const secret = "durable-delivery-test-secret"
const now = Date.parse("2026-11-12T12:00:00Z")
function fixture(t: TestContext) {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    t.mock.timers.enable({ apis: ["Date"], now })
    const ctx = testContext()
    ctx.db.seed("events", {
        _id: "events:one",
        guildId: "guild",
        kind: "match",
        status: "registration",
        gameEnd: "2099-01-01T00:00:00Z",
    })
    return ctx
}
function delivery(ctx: ReturnType<typeof testContext>, owner: DeliveryOwner) {
    const functions: Record<string, unknown> = { begin, finish, plan, reset }
    return new DurableDelivery(owner, (name, args) =>
        invoke(functions[name], ctx, { secret, owner, ...args })
    )
}

test("a crash after job completion cannot lose the durable handoff; acknowledgment is fenced", async (t) => {
    const ctx = fixture(t)
    ctx.db.seed("eventScheduleJobs", {
        _id: "eventScheduleJobs:one",
        eventId: "events:one",
        kind: "attendance-reminder",
        dueAt: new Date(now - 1).toISOString(),
        status: "pending",
        attempts: 0,
    })
    const [job] = await invoke(claimDue, ctx, { secret, fenced: true })
    assert.equal(
        await invoke(completeJob, ctx, {
            secret,
            jobId: job.id,
            claimVersion: job.claimVersion,
            durable: true,
            changedEventIds: ["events:one"],
            scoreEventIds: ["events:one"],
        }),
        true
    )
    assert.equal(await ctx.db.get(job.id), null)
    assert.equal(ctx.db.tables.discordScheduledDispatches.length, 1)
    assert.equal(
        await invoke(completeJob, ctx, {
            secret,
            jobId: job.id,
            claimVersion: job.claimVersion,
            durable: true,
        }),
        false
    )
    assert.equal(
        ctx.db.tables.discordScheduledDispatches.length,
        1,
        "completion replay cannot duplicate inbox work"
    )
    // No worker message is received. A newly started consumer finds the row.
    const first = await invoke(claim, ctx, { secret })
    assert.deepEqual(first.scoreEventIds, ["events:one"])
    t.mock.timers.setTime(now + 6 * 60_000)
    const resumed = await invoke(claim, ctx, { secret })
    assert.equal(resumed.id, first.id)
    assert.notEqual(resumed.claimToken, first.claimToken)
    await assert.rejects(
        invoke(acknowledge, ctx, {
            secret,
            owner: { kind: "dispatch", id: first.id, token: first.claimToken },
        })
    )
    await invoke(acknowledge, ctx, {
        secret,
        owner: { kind: "dispatch", id: resumed.id, token: resumed.claimToken },
    })
    assert.equal(ctx.db.tables.discordScheduledDispatches.length, 0)
})

test("recipient resume skips confirmed and ambiguous effects, continues untouched recipients and preserves counts", async (t) => {
    const ctx = fixture(t),
        id = "eventReminderRequests:one"
    ctx.db.seed("eventReminderRequests", {
        _id: id,
        eventId: "events:one",
        guildId: "guild",
        status: "processing",
        resumable: true,
        claimToken: "first",
        leaseUntil: now + 300000,
    })
    const original = delivery(ctx, { kind: "reminder", id, token: "first" })
    await original.prepare("request", ["a", "b", "c", "d"])
    assert.equal(
        await original.effect("request", "dm:a", async () => true),
        "sent"
    )
    // Discord accepted B, but the process died before its receipt was persisted.
    await invoke(begin, ctx, {
        secret,
        owner: original.owner,
        phase: "request",
        key: "dm:b",
    })
    t.mock.timers.setTime(now + 6 * 60_000)
    await invoke(expire, ctx, { secret })
    assert.equal((await ctx.db.get(id))?.status, "pending")
    await ctx.db.patch(id, {
        status: "processing",
        claimToken: "second",
        leaseUntil: Date.now() + 300000,
    })
    const resumed = delivery(ctx, { kind: "reminder", id, token: "second" })
    const eligible = await resumed.prepare("request", [
        "a",
        "b",
        "c",
        "d",
        "new-member",
    ])
    assert.equal(eligible.has("new-member"), false)
    const sends: string[] = []
    for (const user of eligible)
        await resumed.effect("request", `dm:${user}`, async () => {
            sends.push(user)
            return user !== "d"
        })
    assert.deepEqual(sends, ["c", "d"])
    await invoke(completeReminder, ctx, {
        secret,
        requestId: id,
        claimToken: "second",
        sentCount: 999,
        failedUserIds: ["b"],
    })
    const row = await ctx.db.get(id)
    assert.equal(row?.sentCount, 2)
    assert.deepEqual(
        row?.failedUserIds,
        ["d"],
        "uncertain B is not a confirmed closed DM"
    )
    assert.equal(row?.error, "delivery_uncertain")
})

test("pre-send lookup failure is retryable; ambiguous transport failure is never replayed", async (t) => {
    const ctx = fixture(t),
        id = "eventReminderRequests:one"
    ctx.db.seed("eventReminderRequests", {
        _id: id,
        eventId: "events:one",
        guildId: "guild",
        status: "processing",
        claimToken: "owner",
        leaseUntil: now + 300000,
    })
    const run = delivery(ctx, { kind: "reminder", id, token: "owner" })
    await run.prepare("request", ["a", "b"])
    await assert.rejects(
        run.effect("request", "dm:a", async () => {
            throw new UnattemptedDelivery("lookup unavailable")
        })
    )
    assert.equal(await run.effect("request", "dm:a", async () => true), "sent")
    assert.equal(
        await run.effect("request", "dm:b", async () => {
            throw new Error("connection reset after send")
        }),
        "uncertain"
    )
    assert.equal(
        await run.effect("request", "dm:b", async () => {
            throw new Error("must not replay")
        }),
        "uncertain"
    )
})

test("delivery plans preserve fresh audience narrowing and reject stale ownership", async (t) => {
    const ctx = fixture(t),
        id = "rosterChangeRequests:one"
    ctx.db.seed("rosterChangeRequests", {
        _id: id,
        eventId: "events:one",
        guildId: "guild",
        status: "processing",
        claimToken: "owner",
        leaseUntil: now + 300000,
    })
    const run = delivery(ctx, { kind: "roster", id, token: "owner" })
    await run.prepare("request", ["a", "b"])
    assert.deepEqual([...(await run.prepare("request", ["b", "new"]))], ["b"])
    await assert.rejects(run.effect("request", "dm:outsider", async () => true))
    await ctx.db.patch(id, { claimToken: "new-owner" })
    await assert.rejects(run.effect("request", "mention", async () => {}))
    await assert.rejects(
        invoke(plan, ctx, {
            secret: "invalid",
            owner: run.owner,
            phase: "request",
            recipientIds: [],
        })
    )
})

test("a failed inbox pass remains durable and obeys retry backoff", async (t) => {
    const ctx = fixture(t)
    ctx.db.seed("discordScheduledDispatches", {
        _id: "discordScheduledDispatches:one",
        eventId: "events:one",
        guildId: "guild",
        kind: "refresh-announcement",
        dueAt: "2026-11-12T12:00:00Z",
        status: "pending",
        retryAt: 0,
        attempts: 0,
        changedEventIds: ["events:one"],
        scoreEventIds: [],
        createdAt: now,
    })
    const row = await invoke(claim, ctx, { secret })
    await invoke(retry, ctx, {
        secret,
        owner: { kind: "dispatch", id: row.id, token: row.claimToken },
    })
    assert.equal(await invoke(claim, ctx, { secret }), null)
    t.mock.timers.setTime(now + 60001)
    assert.ok(await invoke(claim, ctx, { secret }))
})

test("scheduled signup resume uses receipts, keeps the original audience and rechecks game/response eligibility", async (t) => {
    const ctx = fixture(t),
        id = "discordScheduledDispatches:one"
    ctx.db.seed("discordScheduledDispatches", {
        _id: id,
        eventId: "events:one",
        guildId: "guild",
        status: "processing",
        claimToken: "owner",
        leaseUntil: now + 300000,
    })
    const run = delivery(ctx, { kind: "dispatch", id, token: "owner" })
    const phase = "signup:2026-11-12"
    await run.prepare(phase, ["a", "b", "c", "answered", "foreign"])
    await run.effect(phase, "dm:a", async () => true)
    await invoke(begin, ctx, { secret, owner: run.owner, phase, key: "dm:b" })
    const payload = boardPayload(
        boardEvent({
            id: "events:one",
            guildId: "guild",
            status: "registration",
            registrationEnd: "2099-01-01T00:00:00Z",
            participants: [
                {
                    userId: "answered",
                    status: "attending",
                    updatedAt: new Date(now).toISOString(),
                },
            ],
        })
    )
    payload.config = { ...payload.config, guildId: "guild" }
    payload.assignments = ["a", "b", "c", "new", "answered", "foreign"].map(
        (userId) => ({
            userId,
            type: "member",
            status: "active",
            gameId: userId === "foreign" ? "wardogs" : "hell_let_loose",
        })
    )
    const sent: string[] = [],
        fetched: string[] = []
    const client = {
        users: {
            fetch: async (userId: string) => {
                fetched.push(userId)
                return {
                    send: async () => {
                        sent.push(userId)
                    },
                }
            },
        },
    } as unknown as Client
    const outcomes: Array<{ sentUserIds: string[]; failedUserIds: string[] }> =
        []
    await processSignupReminders(client, payload, new Set(["events:one"]), {
        delivery: run,
        dueAt: "2026-11-12T12:00:00Z",
        claim: async () => true,
        record: async (outcome) => {
            outcomes.push(outcome)
        },
    })
    assert.deepEqual(sent, ["c"])
    assert.deepEqual(
        fetched,
        ["c"],
        "confirmed and uncertain recipients need no Discord lookup"
    )
    assert.deepEqual(outcomes[0].sentUserIds, ["a", "c"])
    assert.deepEqual(outcomes[0].failedUserIds, [])
})

test("roster digest and mention receipts cannot replay an accepted or ambiguous effect", async (t) => {
    const ctx = fixture(t),
        id = "rosterChangeRequests:one"
    ctx.db.seed("rosterChangeRequests", {
        _id: id,
        eventId: "events:one",
        guildId: "guild",
        status: "processing",
        claimToken: "owner",
        leaseUntil: now + 300000,
    })
    const run = delivery(ctx, { kind: "roster", id, token: "owner" })
    let digests = 0,
        mentions = 0
    await run.effect("request", "digest", async () => {
        digests++
    })
    await invoke(begin, ctx, {
        secret,
        owner: run.owner,
        phase: "request",
        key: "mention",
    })
    await run.effect("request", "digest", async () => {
        digests++
    })
    assert.equal(
        await run.effect("request", "mention", async () => {
            mentions++
        }),
        "uncertain"
    )
    assert.equal(digests, 1)
    assert.equal(mentions, 0)
})

test("scheduled attendance resumes only untouched recipients and reconstructs confirmed logs", async (t) => {
    const ctx = fixture(t),
        id = "discordScheduledDispatches:one"
    ctx.db.seed("discordScheduledDispatches", {
        _id: id,
        eventId: "events:one",
        guildId: "guild",
        status: "processing",
        claimToken: "owner",
        leaseUntil: now + 300000,
    })
    const run = delivery(ctx, { kind: "dispatch", id, token: "owner" })
    await run.prepare("attendance:6", ["a", "b", "c"])
    await run.effect("attendance:6", "dm:a", async () => true)
    await invoke(begin, ctx, {
        secret,
        owner: run.owner,
        phase: "attendance:6",
        key: "dm:b",
    })
    const event = boardEvent({
        id: "events:one",
        guildId: "guild",
        status: "starting",
        meetingStart: new Date(now + 6 * 3600000).toISOString(),
        attendanceReminderHours: [6],
        attendanceReminderLog: [],
        absenceNotices: [],
    })
    const roster = {
        ...boardRoster,
        eventId: event.id,
        published: true,
        reservePlayerIds: [],
        squads: [
            {
                ...boardRoster.squads[0],
                players: ["a", "b", "c"].map((userId) => ({
                    ...boardRoster.squads[0].players[0],
                    id: userId,
                    name: userId,
                    ack: false,
                })),
            },
        ],
    }
    const payload = boardPayload(event, [roster])
    payload.config = { ...payload.config, guildId: "guild" }
    const sent: string[] = [],
        outcomes: Array<Record<string, unknown>> = [],
        logged: Array<{ userId: string }> = []
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (
            reference: Parameters<typeof getFunctionName>[0],
            args: Record<string, unknown>
        ) => {
            if (getFunctionName(reference) === "eventReminders:recordAutomatic")
                outcomes.push(args)
            else if (Array.isArray(args.reminders))
                logged.push(...(args.reminders as Array<{ userId: string }>))
            return null
        }
    )
    const client = {
        guilds: {
            fetch: async () => ({ members: { fetch: async () => new Map() } }),
        },
        users: {
            fetch: async (userId: string) => ({
                send: async () => {
                    sent.push(userId)
                },
            }),
        },
    } as unknown as Client
    await processAttendanceReminders(
        client,
        new Set(),
        payload,
        new Set([event.id]),
        undefined,
        run
    )
    assert.deepEqual(sent, ["c"])
    assert.deepEqual(
        logged.map((row) => row.userId),
        ["a", "c"]
    )
    assert.deepEqual(outcomes[0].failedUserIds, [])
})

test("automatic outcomes aggregate all confirmed receipts and exclude uncertain recipients", async (t) => {
    const ctx = fixture(t),
        id = "discordScheduledDispatches:one"
    ctx.db.seed("discordScheduledDispatches", {
        _id: id,
        eventId: "events:one",
        guildId: "guild",
        status: "processing",
        claimToken: "owner",
        leaseUntil: now + 300000,
    })
    const run = delivery(ctx, { kind: "dispatch", id, token: "owner" })
    await run.prepare("signup:2026-11-12", [
        "sent-before-answer",
        "closed",
        "unknown",
    ])
    await run.effect(
        "signup:2026-11-12",
        "dm:sent-before-answer",
        async () => true
    )
    await run.effect("signup:2026-11-12", "dm:closed", async () => false)
    await invoke(begin, ctx, {
        secret,
        owner: run.owner,
        phase: "signup:2026-11-12",
        key: "dm:unknown",
    })
    await invoke(recordAutomatic, ctx, {
        secret,
        guildId: "guild",
        eventId: "events:one",
        kind: "signup",
        runKey: "2026-11-12",
        sentUserIds: [],
        failedUserIds: ["unknown"],
        owner: run.owner,
    })
    const row = ctx.db.tables.automaticReminderOutcomes[0]
    assert.deepEqual(row.failedUserIds, ["closed"])
    assert.ok(row.recipientIds.includes("sent-before-answer"))
    assert.equal(row.recipientIds.includes("unknown"), false)
})

test("bounded receipt retention removes finished scopes and preserves retryable owners", async (t) => {
    const ctx = fixture(t)
    for (const name of ["finished", "active"]) {
        const id = `eventReminderRequests:${name}`
        ctx.db.seed("eventReminderRequests", {
            _id: id,
            eventId: "events:one",
            guildId: "guild",
            status: "processing",
            claimToken: "owner",
            leaseUntil: now + 300000,
        })
        const run = delivery(ctx, { kind: "reminder", id, token: "owner" })
        await run.prepare("request", ["a"])
        await run.effect("request", "dm:a", async () => true)
        await ctx.db.patch(id, {
            status: name === "finished" ? "sent" : "pending",
        })
    }
    t.mock.timers.setTime(now + 31 * 86400000)
    await pruneDeliveryPlans(ctx as unknown as MutationCtx)
    assert.equal(ctx.db.tables.discordDeliveryEffects.length, 1)
    assert.equal(ctx.db.tables.discordDeliveryPlans.length, 1)
    assert.equal(
        ctx.db.tables.discordDeliveryPlans[0].ownerId,
        "eventReminderRequests:active"
    )
})

test("a resumed signup reservation still respects fresh registration deadlines and preferences", async (t) => {
    const ctx = fixture(t),
        id = "discordScheduledDispatches:one"
    ctx.db.seed("discordScheduledDispatches", {
        _id: id,
        eventId: "events:one",
        guildId: "guild",
        status: "processing",
        kind: "signup-reminder",
        signupReserved: true,
        claimToken: "owner",
        leaseUntil: now + 300000,
    })
    const owner = { kind: "dispatch", id, token: "owner" }
    await ctx.db.patch("events:one", {
        registrationEnd: new Date(now + 1000).toISOString(),
    })
    assert.equal(await invoke(reserveSignup, ctx, { secret, owner }), true)
    await ctx.db.patch("events:one", {
        registrationEnd: new Date(now - 1).toISOString(),
    })
    assert.equal(await invoke(reserveSignup, ctx, { secret, owner }), false)
    await ctx.db.patch("events:one", {
        registrationEnd: new Date(now + 1000).toISOString(),
        signupReminderStatuses: [],
    })
    assert.equal(await invoke(reserveSignup, ctx, { secret, owner }), false)
})

test("retention never erases unresolved send evidence for a terminal owner", async (t) => {
    const ctx = fixture(t)
    for (const state of ["started", "uncertain"]) {
        const id = `eventReminderRequests:${state}`,
            scope = `reminder:${id}`
        ctx.db.seed("eventReminderRequests", {
            _id: id,
            guildId: "guild",
            eventId: "events:one",
            status: "failed",
        })
        ctx.db.seed("discordDeliveryPlans", {
            _id: `discordDeliveryPlans:${state}`,
            scope,
            ownerKind: "reminder",
            ownerId: id,
            eventId: "events:one",
            recipientIds: ["user"],
            expiresAt: now - 1,
            createdAt: now - 31 * 86400000,
        })
        ctx.db.seed("discordDeliveryEffects", {
            _id: `discordDeliveryEffects:${state}`,
            scope,
            key: "dm:user",
            claimToken: "old",
            state,
            createdAt: now - 31 * 86400000,
            updatedAt: now - 31 * 86400000,
        })
    }
    await pruneDeliveryPlans(ctx as unknown as MutationCtx)
    assert.equal(ctx.db.tables.discordDeliveryPlans.length, 2)
    assert.equal(ctx.db.tables.discordDeliveryEffects.length, 2)
    assert.ok(
        ctx.db.tables.discordDeliveryPlans.every((row) => row.expiresAt > now)
    )
})
