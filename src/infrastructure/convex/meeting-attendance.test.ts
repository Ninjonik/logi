import { confirmRosterAttendanceFromMeetingChannel } from "../../../convex/discordRosters"
import { claimMeetingAttendanceRequest } from "../../../convex/meetingAttendance"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

const secret = "synthetic-meeting-request"
function fixture() {
    process.env.INTERNAL_AUTH_SECRET = secret
    const ctx = testContext()
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:one",
        guildId: "guild",
        meetingChannelId: "meeting",
    })
    ctx.db.seed("events", { _id: "events:one", guildId: "guild" })
    ctx.db.seed("rosters", {
        _id: "rosters:one",
        eventId: "events:one",
        squads: [
            {
                name: "A",
                players: [{ id: "assigned", ack: false }, { ack: false }],
            },
        ],
        reservePlayerIds: ["reserve", "assigned"],
        notAttendingPlayerIds: [],
    })
    ctx.db.seed("meetingAttendanceRequests", {
        _id: "meetingAttendanceRequests:one",
        guildId: "guild",
        rosterId: "rosters:one",
        meetingChannelId: "meeting",
        status: "pending",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    return ctx
}
const args = {
    secret,
    guildId: "guild",
    rosterId: "rosters:one",
    expectedMeetingChannelId: "meeting",
    requestId: "meetingAttendanceRequests:one",
    memberIdsInMeetingChannel: ["assigned", "reserve"],
}

test("claim supplies deduplicated roster candidates without storing a voice membership list", async () => {
    const ctx = fixture()
    const claimed = await invoke(claimMeetingAttendanceRequest, ctx, {
        secret,
        requestId: args.requestId,
    })
    assert.deepEqual(claimed.rosterUserIds, ["reserve", "assigned"])
    assert.equal((await ctx.db.get(args.requestId))?.rosterUserIds, undefined)
    assert.equal(
        await invoke(claimMeetingAttendanceRequest, ctx, {
            secret,
            requestId: args.requestId,
        }),
        null
    )
})

test("fresh requested confirmation updates assigned players and reserves", async () => {
    const ctx = fixture()
    await invoke(claimMeetingAttendanceRequest, ctx, {
        secret,
        requestId: args.requestId,
    })
    await ctx.db.patch(args.rosterId, { reservePlayerIds: ["reserve"] })
    const result = await invoke(
        confirmRosterAttendanceFromMeetingChannel,
        ctx,
        args
    )
    assert.equal(result.updatedCount, 2)
    const roster = await ctx.db.get(args.rosterId)
    assert.equal(roster?.squads[0].players[0].confirmed, true)
    assert.equal(
        roster?.reserveAttendances.find(
            (entry: { userId: string }) => entry.userId === "reserve"
        ).confirmed,
        true
    )
})

test("expired, unclaimed, mismatched and completed requests cannot confirm attendance", async () => {
    for (const patch of [
        { status: "pending" },
        { status: "completed" },
        { status: "processing", expiresAt: new Date(0).toISOString() },
        { status: "processing", guildId: "other" },
        { status: "processing", meetingChannelId: "other" },
    ]) {
        const ctx = fixture()
        await ctx.db.patch(args.requestId, patch)
        await assert.rejects(
            invoke(confirmRosterAttendanceFromMeetingChannel, ctx, args),
            /expired or changed/
        )
        assert.equal(
            (await ctx.db.get(args.rosterId))?.squads[0].players[0].confirmed,
            undefined
        )
    }
})
