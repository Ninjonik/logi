import { invoke, testContext } from "./testing/database"
import * as rosters from "../../../convex/rosters"
import assert from "node:assert/strict"
import test from "node:test"

const secret = "synthetic-roster-gateway-secret"
const guildId = "910000000000000001"
const subject = "910000000000000002"
const actor = {
    sid: "s".repeat(43),
    subject,
    userRecordId: "users:admin",
    superadmin: false,
}
const binding = { secret, serverId: "guilds:one", actor }
const input = {
    eventId: "events:one",
    squads: [
        {
            name: "Alpha",
            group: "",
            order: 0,
            color: "#000000",
            players: [{ id: subject, ack: false }],
        },
    ],
    reservePlayerIds: [],
    notAttendingPlayerIds: [],
    published: true,
}

function fixture() {
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
    ctx.db.seed("events", {
        _id: input.eventId,
        guildId,
        gameId: "wardogs",
        status: "starting",
        registrationEnd: "2020-01-01T00:00:00Z",
        meetingStart: new Date(Date.now() + 60_000).toISOString(),
        gameEnd: new Date(Date.now() + 3_600_000).toISOString(),
        participants: [
            {
                userId: subject,
                status: "attending",
                updatedAt: "2020-01-01T00:00:00Z",
            },
        ],
    })
    ctx.db.seed("rosters", { _id: "rosters:one", ...input, guildId })
    return ctx
}

test("native roster writes reject missing, wrong and unconfigured gateway credentials", async () => {
    for (const method of [
        rosters.upsert,
        rosters.setAttendanceStatus,
        rosters.acknowledgeAttendance,
    ]) {
        for (const provided of [undefined, "wrong"]) {
            const ctx = fixture()
            await assert.rejects(
                invoke(method, ctx, {
                    ...binding,
                    ...input,
                    guildId,
                    userId: subject,
                    status: "confirmed",
                    secret: provided,
                })
            )
            assert.equal(
                ctx.db.tables.rosters[0].squads[0].players[0].ack,
                false
            )
        }
    }
    const ctx = fixture()
    delete process.env.INTERNAL_AUTH_SECRET
    await assert.rejects(invoke(rosters.upsert, ctx, { ...binding, ...input }))
})

test("manager writes require the current exact durable session and current admin access", async () => {
    for (const change of [
        "revoked",
        "expired",
        "rebound",
        "removed-role",
        "wrong-subject",
    ] as const) {
        const ctx = fixture()
        if (change === "revoked")
            await ctx.db.patch("dashboardSessions:one", {
                revokedAt: Date.now(),
            })
        if (change === "expired")
            await ctx.db.patch("dashboardSessions:one", {
                expiresAt: Date.now(),
            })
        if (change === "rebound")
            await ctx.db.patch(actor.userRecordId, {
                discordId: "910000000000000003",
            })
        if (change === "removed-role")
            await ctx.db.patch("guilds:one", { adminIds: [] })
        const supplied =
            change === "wrong-subject"
                ? { ...actor, subject: "910000000000000003" }
                : actor
        for (const method of [rosters.upsert, rosters.setAttendanceStatus]) {
            await assert.rejects(
                invoke(method, ctx, {
                    ...binding,
                    ...input,
                    actor: supplied,
                    userId: subject,
                    status: "confirmed",
                })
            )
        }
        assert.equal(ctx.db.tables.rosters[0].squads[0].players[0].ack, false)
    }
})

test("manager upsert preserves event, roster and preset tenant bindings", async () => {
    for (const target of [
        "event",
        "roster",
        "preset",
        "missing-roster",
    ] as const) {
        const ctx = fixture()
        ctx.db.seed("events", {
            _id: "events:foreign",
            guildId: "910000000000000009",
            registrationEnd: "2020-01-01T00:00:00Z",
        })
        ctx.db.seed("rosters", {
            _id: "rosters:foreign",
            ...input,
            eventId: "events:foreign",
        })
        ctx.db.seed("squadPresets", {
            _id: "squadPresets:foreign",
            guildId: "910000000000000009",
        })
        const extra =
            target === "event"
                ? { eventId: "events:foreign" }
                : target === "preset"
                  ? { squadPresetId: "squadPresets:foreign" }
                  : {
                        rosterId:
                            target === "roster"
                                ? "rosters:foreign"
                                : "rosters:missing",
                    }
        await assert.rejects(
            invoke(rosters.upsert, ctx, { ...binding, ...input, ...extra })
        )
        assert.equal(ctx.db.tables.rosters[0].eventId, input.eventId)
    }
})

test("native roster creation does not add members from a different game", async () => {
    for (const gameId of ["wardogs", "hell_let_loose"] as const) {
        const ctx = fixture()
        await ctx.db.patch(input.eventId, { gameId, participants: [] })
        for (const [userId, memberGame] of [
            ["wdg-member", "wardogs"],
            ["hll-member", "hell_let_loose"],
            ["legacy-hll", undefined],
        ] as const) {
            ctx.db.seed("userAssignments", {
                _id: `userAssignments:${userId}`,
                userId,
                serverId: guildId,
                gameId: memberGame,
                createdAt: "2019-01-01T00:00:00Z",
            })
        }
        await invoke(rosters.upsert, ctx, { ...binding, ...input, squads: [] })
        assert.deepEqual(
            ctx.db.tables.rosters[0].notAttendingPlayerIds.sort(),
            gameId === "wardogs" ? ["wdg-member"] : ["hll-member", "legacy-hll"]
        )
    }
})

test("roster presets require the same game as well as the same guild", async () => {
    const ctx = fixture()
    ctx.db.seed("squadPresets", {
        _id: "squadPresets:local",
        guildId,
        gameId: "hell_let_loose",
    })
    const args = { ...binding, ...input, squadPresetId: "squadPresets:local" }
    await assert.rejects(invoke(rosters.upsert, ctx, args), /event's game/)
    await ctx.db.patch("squadPresets:local", { gameId: "wardogs" })
    assert.equal(await invoke(rosters.upsert, ctx, args), "rosters:one")
})

test("valid manager writes and bot acknowledgements retain native tracked changes", async () => {
    const ctx = fixture()
    assert.equal(
        await invoke(rosters.upsert, ctx, {
            ...binding,
            ...input,
            rosterId: "rosters:one",
        }),
        "rosters:one"
    )
    await invoke(rosters.setAttendanceStatus, ctx, {
        ...binding,
        eventId: input.eventId,
        userId: subject,
        status: "confirmed",
    })
    assert.equal(ctx.db.tables.rosters[0].squads[0].players[0].confirmed, true)
    // A trusted DM interaction needs the authoritative event guild, not a Discord channel guild.
    await invoke(rosters.acknowledgeAttendance, ctx, {
        secret,
        guildId,
        eventId: input.eventId,
        userId: subject,
    })
    assert.equal(ctx.db.tables.rosters[0].squads[0].players[0].ack, true)
    assert.ok(
        ctx.db.tables.integrationChanges.some(
            (row) => row.resource === "roster-summaries"
        )
    )
})

test("bot attendance rechecks current event, publication, target and tenant", async () => {
    for (const change of ["closed", "draft", "foreign", "absent"] as const) {
        const ctx = fixture()
        if (change === "closed")
            await ctx.db.patch(input.eventId, { status: "concluded" })
        if (change === "draft")
            await ctx.db.patch("rosters:one", { published: false })
        await assert.rejects(
            invoke(rosters.acknowledgeAttendance, ctx, {
                secret,
                guildId: change === "foreign" ? "910000000000000009" : guildId,
                eventId: input.eventId,
                userId: change === "absent" ? "910000000000000003" : subject,
            })
        )
        assert.equal(ctx.db.tables.rosters[0].squads[0].players[0].ack, false)
    }
})

test("attendance follows current event times even before the status reconciler runs", async () => {
    const ctx = fixture()
    await ctx.db.patch(input.eventId, { status: "registration" })
    await invoke(rosters.acknowledgeAttendance, ctx, {
        secret,
        guildId,
        eventId: input.eventId,
        userId: subject,
    })
    assert.equal(ctx.db.tables.rosters[0].squads[0].players[0].ack, true)
    await ctx.db.patch(input.eventId, {
        status: "starting",
        gameEnd: new Date(Date.now() - 1_000).toISOString(),
    })
    // Upstream keeps attendance open during the 15-minute conclusion reserve.
    await invoke(rosters.acknowledgeAttendance, ctx, {
        secret,
        guildId,
        eventId: input.eventId,
        userId: subject,
    })
    await ctx.db.patch(input.eventId, {
        gameEnd: new Date(Date.now() - 15 * 60_000 - 1_000).toISOString(),
    })
    await assert.rejects(
        invoke(rosters.acknowledgeAttendance, ctx, {
            secret,
            guildId,
            eventId: input.eventId,
            userId: subject,
        })
    )
})
