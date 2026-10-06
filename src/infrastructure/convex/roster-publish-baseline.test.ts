import * as rosterChanges from "../../../convex/rosterChanges"
import { invoke, testContext } from "./testing/database"
import * as rosters from "../../../convex/rosters"
import assert from "node:assert/strict"
import test from "node:test"

/**
 * The published squad snapshot the server keeps at every publish (D5-B04)
 * and the first-publish mention without a roster channel (D5-08).
 */

const secret = ["synthetic", "roster", "baseline"].join("-")
const guildId = "910000000000000001"
const subject = "910000000000000002"
const rex = "910000000000000011"
const zubr = "910000000000000012"
const krtek = "910000000000000013"
const actor = {
    sid: "s".repeat(43),
    subject,
    userRecordId: "users:admin",
    superadmin: false,
}
const binding = { secret, serverId: "guilds:one", actor }

const squads = (players: Array<[string, string, string?]>) =>
    ["F1", "F2"].map((name, order) => ({
        name,
        group: "Pěchota",
        order,
        color: "#000000",
        players: players
            .filter(([, squad]) => squad === name)
            .map(([id, , roleName]) => ({
                id,
                ack: false,
                ...(roleName ? { roleName } : {}),
            })),
    }))

const firstVersion = squads([
    [rex, "F1", "Squad Leader"],
    [zubr, "F1", "Anti-Tank"],
])
const secondVersion = squads([
    [rex, "F1", "Squad Leader"],
    [zubr, "F2", "Anti-Tank"],
    [krtek, "F2", "Medic"],
])

function fixture(channels: { info?: string } = { info: "300000000000000002" }) {
    process.env.INTERNAL_AUTH_SECRET = secret
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:one",
        discordId: guildId,
        adminIds: [subject],
    })
    ctx.db.seed("users", {
        _id: actor.userRecordId,
        discordId: subject,
        name: "Synthetic manager",
    })
    ctx.db.seed("dashboardSessions", {
        _id: "dashboardSessions:one",
        sid: actor.sid,
        subject,
        userRecordId: actor.userRecordId,
        userSessionVersion: 0,
        expiresAt: Date.now() + 60_000,
    })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:one",
        guildId,
        announcementsChannelId: "300000000000000001",
        ...(channels.info ? { eventInfoChannelId: channels.info } : {}),
    })
    ctx.db.seed("events", {
        _id: "events:one",
        guildId,
        kind: "match",
        gameId: "hell_let_loose",
        status: "registration",
        registrationEnd: "2099-01-01T00:00:00Z",
        meetingStart: "2099-01-02T17:30:00Z",
        gameStart: "2099-01-02T18:00:00Z",
        gameEnd: "2099-01-02T20:00:00Z",
        participants: [],
    })
    return ctx
}

const publish = (
    ctx: ReturnType<typeof testContext>,
    squadList: typeof firstVersion,
    extra: Record<string, unknown> = {}
) =>
    invoke(rosters.upsert, ctx, {
        ...binding,
        eventId: "events:one",
        squads: squadList,
        reservePlayerIds: [],
        notAttendingPlayerIds: [],
        published: true,
        ...extra,
    })

const changeRequest = (
    ctx: ReturnType<typeof testContext>,
    extra: Record<string, unknown> = {}
) =>
    invoke(rosterChanges.request, ctx, {
        secret,
        guildId,
        eventId: "events:one",
        rosterId: ctx.db.tables.rosters[0]._id,
        requestedBy: subject,
        notifyPlayers: true,
        postDigest: true,
        mentionPlayers: false,
        ...extra,
    })

test("every publish stores what it shows and what it replaced (D5-B04)", async () => {
    const ctx = fixture()
    await publish(ctx, firstVersion)
    const first = ctx.db.tables.rosters[0]
    assert.deepEqual(first.publishedPlaces, [
        { userId: rex, squad: "F1", role: "Squad Leader" },
        { userId: zubr, squad: "F1", role: "Anti-Tank" },
    ])
    // A first publish has nothing to compare with.
    assert.equal(first.previousPublishedPlaces, undefined)
    const firstPlaces = structuredClone(first.publishedPlaces)

    await publish(ctx, secondVersion, { rosterId: first._id })
    const second = ctx.db.tables.rosters[0]
    assert.deepEqual(second.previousPublishedPlaces, firstPlaces)
    assert.equal(second.publishedPlaces.length, 3)
})

test("a roster published before the snapshots existed counts its saved squads as the last version", async () => {
    const ctx = fixture()
    ctx.db.seed("rosters", {
        _id: "rosters:legacy",
        guildId,
        eventId: "events:one",
        squads: firstVersion,
        reservePlayerIds: [],
        notAttendingPlayerIds: [],
        published: true,
    })
    await publish(ctx, secondVersion, { rosterId: "rosters:legacy" })
    assert.deepEqual(ctx.db.tables.rosters[0].previousPublishedPlaces, [
        { userId: rex, squad: "F1", role: "Squad Leader" },
        { userId: zubr, squad: "F1", role: "Anti-Tank" },
    ])
})

test("the change request compares with the server's baseline and ignores a browser's (D5-B04)", async () => {
    const ctx = fixture()
    await publish(ctx, firstVersion)
    await publish(ctx, secondVersion, {
        rosterId: ctx.db.tables.rosters[0]._id,
    })
    const result = await changeRequest(ctx, {
        // An older or tampered dashboard: a stranger and another baseline.
        before: [{ userId: "910000000000000099", squad: "F9" }],
    })
    assert.equal(result.status, "queued")
    assert.equal(result.hasChanges, true)
    const row = ctx.db.tables.rosterChangeRequests[0]
    assert.deepEqual(row.before, [
        { userId: rex, squad: "F1", role: "Squad Leader" },
        { userId: zubr, squad: "F1", role: "Anti-Tank" },
    ])
    assert.equal(row.notifyPlayers, true)
    assert.equal(row.postDigest, true)
    assert.equal(row.rosterPublishedAt, ctx.db.tables.rosters[0].publishedAt)

    // One request per publish: asking again returns the queued one.
    const again = await changeRequest(ctx)
    assert.equal(again.requestId, result.requestId)
    assert.equal(ctx.db.tables.rosterChangeRequests.length, 1)
})

test("without changes since the last publish nothing is queued unless the players are mentioned", async () => {
    const ctx = fixture()
    await publish(ctx, firstVersion)
    await publish(ctx, firstVersion, {
        rosterId: ctx.db.tables.rosters[0]._id,
    })
    assert.deepEqual(await changeRequest(ctx), {
        status: "nothing",
        hasChanges: false,
    })
    const mention = await changeRequest(ctx, { mentionPlayers: true })
    assert.equal(mention.status, "queued")
    const row = ctx.db.tables.rosterChangeRequests[0]
    assert.equal(row.notifyPlayers, false)
    assert.equal(row.postDigest, false)
    assert.equal(row.mentionPlayers, true)
})

test("a first publish with mentions and no roster channel queues one mention reply (D5-08)", async () => {
    const ctx = fixture({})
    await publish(ctx, firstVersion, {
        discordPublish: { variant: "photo_text", mentionPlayers: true },
    })
    const requests = ctx.db.tables.rosterChangeRequests ?? []
    assert.equal(requests.length, 1)
    assert.equal(requests[0].firstPublish, true)
    assert.equal(requests[0].mentionPlayers, true)
    assert.equal(requests[0].notifyPlayers, false)
    assert.equal(requests[0].postDigest, false)
    assert.equal(requests[0].requestedBy, subject)

    // A re-publish never adds another first-publish mention.
    await publish(ctx, secondVersion, {
        rosterId: ctx.db.tables.rosters[0]._id,
        discordPublish: { variant: "photo_text", mentionPlayers: true },
    })
    assert.equal(ctx.db.tables.rosterChangeRequests.length, 1)
})

test("with a roster channel the roster message pings itself; mentions off queue nothing (D5-08)", async () => {
    const split = fixture()
    await publish(split, firstVersion, {
        discordPublish: { variant: "photo_text", mentionPlayers: true },
    })
    assert.equal((split.db.tables.rosterChangeRequests ?? []).length, 0)

    const off = fixture({})
    await publish(off, firstVersion, {
        discordPublish: { variant: "photo_text", mentionPlayers: false },
    })
    assert.equal((off.db.tables.rosterChangeRequests ?? []).length, 0)
})
