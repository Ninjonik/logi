import { isRegistrationAnnouncementDue } from "../../domain/events/registration-announcement"
import { sharedMatchSettingsSchema } from "../../lib/validation/shared-match-settings"
import * as announcements from "../../../convex/eventAnnouncements"
import { seedDashboardActor } from "./testing/dashboard-actor"
import * as sharedApi from "../../../convex/sharedMatchApi"
import * as discordSync from "../../../convex/discordSync"
import { invoke, testContext } from "./testing/database"
import * as shared from "../../../convex/sharedMatches"
import * as publicApi from "../../../convex/publicApi"
import * as recaps from "../../../convex/matchRecaps"
import * as rosters from "../../../convex/rosters"
import * as events from "../../../convex/events"
import assert from "node:assert/strict"
import test from "node:test"

const secret = "synthetic-shared-match-test"
const hostGuild = "100000000000000100"
const guestGuild = "100000000000000200"
const hostPlayer = "100000000000000101"
const guestPlayer = "100000000000000201"

async function fixture(registrationStart?: string) {
    process.env.INTERNAL_AUTH_SECRET = secret
    const ctx = testContext()
    const actor = seedDashboardActor(ctx.db, hostGuild)
    await ctx.db.patch("guilds:admin", {
        name: "Host",
        botInside: true,
        adminIds: [actor.subject],
    })
    ctx.db.seed("guilds", {
        _id: "guilds:guest",
        discordId: guestGuild,
        name: "Guest",
        botInside: true,
        adminIds: [actor.subject],
    })
    const now = new Date().toISOString()
    for (const [id, guildId] of [
        [hostPlayer, hostGuild],
        [guestPlayer, guestGuild],
    ]) {
        ctx.db.seed("users", {
            _id: `users:${id}`,
            discordId: id,
            guildId,
            name: id,
            nicknames: {},
        })
        ctx.db.seed("userAssignments", {
            _id: `userAssignments:${id}`,
            serverId: guildId,
            userId: id,
            status: "active",
            type: "member",
            gameId: "hell_let_loose",
            createdAt: "2020-01-01T00:00:00Z",
            updatedAt: now,
        })
    }
    ctx.db.seed("events", {
        _id: "events:host",
        guildId: hostGuild,
        name: "Shared match",
        kind: "match",
        gameId: "hell_let_loose",
        registrationEnd: new Date(Date.now() + 3_600_000).toISOString(),
        meetingStart: new Date(Date.now() + 7_200_000).toISOString(),
        gameStart: new Date(Date.now() + 9_000_000).toISOString(),
        gameEnd: new Date(Date.now() + 12_000_000).toISOString(),
        status: "registration",
        pingClan: false,
        createdAt: now,
        updatedAt: now,
        participants: [
            { userId: hostPlayer, status: "attending", updatedAt: now },
        ],
    })
    ctx.db.seed("rosters", {
        _id: "rosters:host",
        eventId: "events:host",
        guildId: hostGuild,
        squads: [
            {
                name: "Alpha",
                group: "Infantry",
                color: "#ffffff",
                order: 0,
                players: [
                    { id: hostPlayer, roleName: "Leader", ack: false },
                    {
                        allocatedGuildId: guestGuild,
                        roleName: "Rifleman",
                        ack: false,
                    },
                ],
            },
        ],
        reservePlayerIds: [],
        notAttendingPlayerIds: [],
        published: false,
        createdAt: now,
        updatedAt: now,
    })
    const scope = { secret, actor, guildId: hostGuild }
    const invitationId = await invoke(shared.invite, ctx, {
        ...scope,
        eventId: "events:host",
        guestGuildId: guestGuild,
        requestedRoles: [{ role: "Infantry", count: 1 }],
    })
    const localId = await invoke(shared.respond, ctx, {
        ...scope,
        guildId: guestGuild,
        invitationId,
        accept: true,
        registrationStart,
    })
    return { ctx, actor, scope, invitationId, localId }
}

function payload(
    row: Awaited<ReturnType<ReturnType<typeof testContext>["db"]["get"]>>
) {
    assert.ok(row)
    return {
        rosterId: row._id,
        eventId: row.eventId,
        squads: structuredClone(row.squads),
        reservePlayerIds: row.reservePlayerIds,
        reserveAttendances: row.reserveAttendances,
        notAttendingPlayerIds: row.notAttendingPlayerIds,
        published: row.published,
        expectedUpdatedAt: row.updatedAt,
    }
}

test("accepting creates one external match, keeps local signups and exposes the full draft roster", async () => {
    const { ctx, localId, scope, invitationId } = await fixture()
    const local = await ctx.db.get(localId)
    assert.equal(local?.hostEventId, "events:host")
    assert.equal(local?.hostClanName, "Host")
    assert.equal(local?.pingMode, "none")
    assert.equal(local?.participants?.length ?? 0, 0)
    const localRoster = ctx.db.tables.rosters.find(
        (row) => row.eventId === localId
    )!
    assert.equal(localRoster.published, false)
    assert.equal(localRoster.squads[0].players[0].id, hostPlayer)
    assert.deepEqual(localRoster.localPlayerIds, [guestPlayer])
    await assert.rejects(
        invoke(shared.respond, ctx, {
            ...scope,
            guildId: guestGuild,
            invitationId,
            accept: true,
        }),
        /Invitation unavailable/
    )
    assert.equal(ctx.db.tables.events.length, 2)
})

test("guest draft saves update its allocated slot in every clan's roster", async () => {
    const { ctx, actor, localId } = await fixture()
    const local = ctx.db.tables.rosters.find((row) => row.eventId === localId)!
    const input = payload(local)
    input.squads[0].players[1].id = guestPlayer
    await invoke(rosters.upsert, ctx, {
        secret,
        actor,
        serverId: "guilds:guest",
        ...input,
    })
    assert.equal(
        (await ctx.db.get("rosters:host"))?.squads[0].players[1].id,
        guestPlayer
    )
    assert.equal(
        (await ctx.db.get(local._id))?.squads[0].players[1].id,
        guestPlayer
    )
    assert.equal((await ctx.db.get("rosters:host"))?.published, false)
})

test("guest cannot change another clan's player, a lock, layout, publication, or foreign player", async () => {
    for (const change of ["other", "lock", "layout", "publish", "foreign"]) {
        const { ctx, actor, localId } = await fixture()
        const local = ctx.db.tables.rosters.find(
            (row) => row.eventId === localId
        )!
        const input = payload(local)
        if (change === "other") input.squads[0].players[0].id = guestPlayer
        if (change === "lock") input.squads[0].players[1].locked = true
        if (change === "layout") input.squads[0].name = "Changed"
        if (change === "publish") input.published = true
        if (change === "foreign") input.squads[0].players[1].id = hostPlayer
        await assert.rejects(
            invoke(rosters.upsert, ctx, {
                secret,
                actor,
                serverId: "guilds:guest",
                ...input,
            })
        )
        assert.equal(
            (await ctx.db.get("rosters:host"))?.squads[0].players[0].id,
            hostPlayer
        )
    }
})

test("host publication automatically publishes the guest view and stale guest saves are rejected", async () => {
    const { ctx, actor, localId } = await fixture()
    const local = ctx.db.tables.rosters.find((row) => row.eventId === localId)!
    const stale = payload(local)
    const input = payload(await ctx.db.get("rosters:host"))
    input.published = true
    input.squads[0].players[1].locked = true
    await invoke(rosters.upsert, ctx, {
        secret,
        actor,
        serverId: "guilds:admin",
        ...input,
    })
    const copy = await ctx.db.get(local._id)
    assert.equal(copy?.published, true)
    assert.ok(copy?.publishedAt)
    assert.equal(copy?.squads[0].players[1].locked, true)
    stale.squads[0].players[1].id = guestPlayer
    await assert.rejects(
        invoke(rosters.upsert, ctx, {
            secret,
            actor,
            serverId: "guilds:guest",
            ...stale,
        })
    )
})

test("host unpublication returns every participating roster to draft", async () => {
    const { ctx, actor, localId } = await fixture()
    const localRoster = ctx.db.tables.rosters.find(
        (row) => row.eventId === localId
    )!
    for (const published of [true, false]) {
        const input = payload(await ctx.db.get("rosters:host"))
        input.published = published
        await invoke(rosters.upsert, ctx, {
            secret,
            actor,
            serverId: "guilds:admin",
            ...input,
        })
        assert.equal((await ctx.db.get("rosters:host"))?.published, published)
        assert.equal((await ctx.db.get(localRoster._id))?.published, published)
    }
})

test("v1 roster writes enforce the same guest slot permissions and replay once", async () => {
    const { ctx, localId } = await fixture()
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:guest",
        guildId: guestGuild,
        keyHash: "guest-key",
    })
    const local = ctx.db.tables.rosters.find((row) => row.eventId === localId)!
    const { rosterId, ...input } = payload(local)
    input.squads[0].players[1].id = guestPlayer
    const args = {
        secret,
        keyHash: "guest-key",
        idempotencyKey: "shared-save",
        bodyHash: "shared-save",
        methodPath: "PATCH /rosters/local",
        operation: "update",
        rosterId,
        payload: input,
    }
    const result = await invoke(publicApi.mutateClanRoster, ctx, args)
    assert.equal(result.status, 200, result.body)
    assert.deepEqual(
        await invoke(publicApi.mutateClanRoster, ctx, args),
        result
    )
    assert.equal(
        (await ctx.db.get("rosters:host"))?.squads[0].players[1].id,
        guestPlayer
    )
})

test("revoking freezes local history and blocks further guest writes", async () => {
    const { ctx, actor, scope, localId, invitationId } = await fixture()
    const local = ctx.db.tables.rosters.find((row) => row.eventId === localId)!
    await invoke(shared.revoke, ctx, { ...scope, invitationId })
    assert.equal((await ctx.db.get(localId))?.sharedAccessRevoked, true)
    assert.ok(await ctx.db.get(local._id))
    assert.equal(
        (await ctx.db.get("rosters:host"))?.squads[0].players[1]
            .allocatedGuildId,
        undefined
    )
    await assert.rejects(
        invoke(rosters.upsert, ctx, {
            secret,
            actor,
            serverId: "guilds:guest",
            ...payload(local),
        }),
        /no longer participating/
    )
})

test("external clans cannot conclude the host's match", async () => {
    const { ctx, localId } = await fixture()
    await assert.rejects(
        invoke(events.conclude, ctx, { secret, eventId: localId }),
        /Only the host/
    )
})

test("Discord signup displays stay local even when the host has the full roster", async () => {
    const { ctx, localId } = await fixture()
    const host = await invoke(discordSync.getEventSyncContext, ctx, {
        secret,
        eventId: "events:host",
    })
    const guest = await invoke(discordSync.getEventSyncContext, ctx, {
        secret,
        eventId: localId,
    })
    assert.deepEqual(
        host.event.signUps.map((item: { userId: string }) => item.userId),
        [hostPlayer]
    )
    assert.deepEqual(guest.event.signUps, [])
    assert.equal(guest.roster.squads[0].players[0].id, hostPlayer)
    assert.ok(!guest.roster.notAttendingPlayerIds.includes(hostPlayer))
})

test("dashboard and API local settings share validation and preserve host details", async () => {
    const { ctx, scope, localId } = await fixture()
    const settings = sharedMatchSettingsSchema.parse({
        createParticipantRoles: false,
        attendanceReminderHours: [12],
        signupGroupLimits: [],
        registrationStart: new Date(Date.now() + 1_800_000).toISOString(),
        pingMode: "clan",
    })
    await invoke(shared.configureLocal, ctx, {
        ...scope,
        guildId: guestGuild,
        eventId: localId,
        ...settings,
    })
    assert.equal((await ctx.db.get(localId))?.pingClan, true)
    assert.equal((await ctx.db.get("events:host"))?.pingClan, false)
    assert.deepEqual((await ctx.db.get(localId))?.attendanceReminderHours, [12])
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:guest",
        guildId: guestGuild,
        keyHash: "guest-key",
    })
    const args = {
        secret,
        keyHash: "guest-key",
        eventId: localId,
        idempotencyKey: "local-settings",
        bodyHash: "local-settings",
        methodPath: "PATCH /local-settings",
        settings: { ...settings, pingMode: "none" },
    }
    const result = await invoke(sharedApi.configureLocal, ctx, args)
    assert.equal(result.status, 200)
    assert.equal(
        (await ctx.db.get(localId))?.registrationStart,
        settings.registrationStart
    )
    assert.deepEqual(await invoke(sharedApi.configureLocal, ctx, args), result)
    const invalid = await invoke(sharedApi.configureLocal, ctx, {
        ...args,
        idempotencyKey: "invalid",
        settings: { ...settings, name: "Overwrite host" },
    })
    assert.equal(invalid.status, 400)
    assert.equal((await ctx.db.get(localId))?.name, "Shared match")
})

test("main clan takes priority while mercenaries can be selected by either eligible clan", async () => {
    const { ctx, scope, localId, actor } = await fixture()
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:merc",
        userId: guestPlayer,
        serverId: hostGuild,
        gameId: "hell_let_loose",
        status: "active",
        type: "mercenary",
        createdAt: "2020-01-01T00:00:00Z",
    })
    const hostContext = await invoke(shared.rosterContext, ctx, {
        ...scope,
        eventId: "events:host",
    })
    assert.deepEqual(
        hostContext.users.find(
            (user: { discordId: string }) => user.discordId === guestPlayer
        ).sharedEligibleGuildIds,
        [guestGuild]
    )
    await ctx.db.patch(`users:${guestPlayer}`, { guildId: "another-main-clan" })
    const guestContext = await invoke(shared.rosterContext, ctx, {
        ...scope,
        guildId: guestGuild,
        eventId: localId,
    })
    assert.deepEqual(
        guestContext.users.find(
            (user: { discordId: string }) => user.discordId === guestPlayer
        ).sharedEligibleGuildIds,
        [hostGuild, guestGuild]
    )
    const local = ctx.db.tables.rosters.find((row) => row.eventId === localId)!
    const input = payload(local)
    input.squads[0].players[1].id = guestPlayer
    await invoke(rosters.upsert, ctx, {
        secret,
        actor,
        serverId: "guilds:guest",
        ...input,
    })
    assert.ok(
        (await ctx.db.get(local._id))?.localPlayerIds.includes(guestPlayer)
    )
    assert.ok(
        !(await ctx.db.get("rosters:host"))?.localPlayerIds.includes(
            guestPlayer
        )
    )
})

test("guest attendance reaches the canonical roster and rejects another clan's player", async () => {
    const { ctx, actor, localId } = await fixture()
    const input = payload(await ctx.db.get("rosters:host"))
    input.published = true
    input.squads[0].players[1].id = guestPlayer
    await invoke(rosters.upsert, ctx, {
        secret,
        actor,
        serverId: "guilds:admin",
        ...input,
    })
    await invoke(rosters.acknowledgeAttendance, ctx, {
        secret,
        eventId: localId,
        guildId: guestGuild,
        userId: guestPlayer,
    })
    assert.equal(
        (await ctx.db.get("rosters:host"))?.squads[0].players[1].ack,
        true
    )
    await assert.rejects(
        invoke(rosters.acknowledgeAttendance, ctx, {
            secret,
            eventId: localId,
            guildId: guestGuild,
            userId: hostPlayer,
        }),
        /Attendance unavailable/
    )
})

test("shared recaps use the player's clan delivery settings and one canonical statistics record", async () => {
    const { ctx, actor, localId } = await fixture()
    const input = payload(await ctx.db.get("rosters:host"))
    input.squads[0].players[1].id = guestPlayer
    await invoke(rosters.upsert, ctx, {
        secret,
        actor,
        serverId: "guilds:admin",
        ...input,
    })
    await ctx.db.patch("events:host", {
        eventResult: {
            sourceUrl: "https://stats.test",
            mapId: "map",
            sideA: "Allies",
            sideB: "Axis",
            score: { sideA: 5, sideB: 0 },
            importedAt: new Date().toISOString(),
            outcome: "victory",
        },
    })
    ctx.db.seed("playerStats", {
        _id: "playerStats:guest",
        userId: guestPlayer,
        matches: {
            "events:host": {
                gameId: "hell_let_loose",
                kills: 10,
                deaths: 5,
                killDeathRatio: 2,
                mapName: "Map",
                importedAt: new Date().toISOString(),
            },
        },
    })
    const result = await invoke(recaps.queueForPublishedResult, ctx, {
        secret,
        eventId: "events:host",
        baselines: [],
    })
    assert.equal(result.queued, 1)
    assert.equal(ctx.db.tables.matchRecaps[0].eventId, localId)
    assert.equal(ctx.db.tables.matchRecaps[0].sourceEventId, "events:host")
    assert.equal(
        (
            await invoke(recaps.queueForPublishedResult, ctx, {
                secret,
                eventId: "events:host",
                baselines: [],
            })
        ).queued,
        0
    )
    assert.equal(
        (
            await invoke(recaps.listPendingForEvent, ctx, {
                secret,
                eventId: localId,
                deliveryVersion: 2,
            })
        )[0].kills,
        10
    )
})

test("host edits propagate match facts while preserving guest Discord choices", async () => {
    const { ctx, scope, localId } = await fixture()
    const settings = sharedMatchSettingsSchema.parse({
        createParticipantRoles: false,
        attendanceReminderHours: [],
        signupGroupLimits: [],
        announcementChannelId: "guest-channel",
        localRosterMessageVariant: "photo",
        localRosterMentionPlayers: true,
    })
    await invoke(shared.configureLocal, ctx, {
        ...scope,
        guildId: guestGuild,
        eventId: localId,
        ...settings,
    })
    const host = await ctx.db.get("events:host")
    await invoke(events.upsert, ctx, {
        secret,
        serverId: "guilds:admin",
        eventId: "events:host",
        kind: "match",
        gameId: "hell_let_loose",
        name: "Updated match",
        registrationEnd: host!.registrationEnd,
        meetingStart: host!.meetingStart,
        gameStart: host!.gameStart,
        gameEnd: host!.gameEnd,
        pingClan: false,
    })
    const local = await ctx.db.get(localId)
    assert.equal(local?.name, "Updated match")
    assert.equal(local?.announcementChannelId, "guest-channel")
    assert.equal(local?.createParticipantRoles, false)
    const roster = ctx.db.tables.rosters.find((row) => row.eventId === localId)!
    assert.equal(roster.discordMessageVariant, "photo")
    assert.equal(roster.discordMentionPlayers, true)
})

test("local signup writes update the shared reserve pool and respect main-clan priority", async () => {
    const { ctx, localId } = await fixture()
    await assert.rejects(
        invoke(events.toggleSignUp, ctx, {
            secret,
            eventId: "events:host",
            userId: guestPlayer,
            group: "GENERAL",
        }),
        /main clan/
    )
    await invoke(events.toggleSignUp, ctx, {
        secret,
        eventId: localId,
        userId: guestPlayer,
        group: "GENERAL",
    })
    assert.ok(
        (await ctx.db.get("rosters:host"))?.reservePlayerIds.includes(
            guestPlayer
        )
    )
    assert.equal((await ctx.db.get("events:host"))?.participants.length, 1)
    assert.equal(
        (await ctx.db.get(localId))?.participants[0].userId,
        guestPlayer
    )
})

test("acceptance schedules registration locally and host updates preserve the guest opening", async () => {
    const registrationStart = new Date(Date.now() + 1_800_000).toISOString()
    const { ctx, localId, scope, invitationId } =
        await fixture(registrationStart)
    const local = await ctx.db.get(localId)
    assert.equal(local?.registrationStart, registrationStart)
    assert.equal(
        isRegistrationAnnouncementDue({
            registrationStart: local?.registrationStart,
        }),
        false
    )
    assert.equal(
        isRegistrationAnnouncementDue(
            { registrationStart: local?.registrationStart },
            new Date(registrationStart)
        ),
        true
    )
    assert.ok(
        (ctx.db.tables.eventScheduleJobs ?? []).some(
            (row) =>
                row.eventId === localId && row.kind === "registration-start"
        )
    )
    await ctx.db.patch("events:host", {
        name: "Updated host",
        registrationStart: new Date().toISOString(),
    })
    // A local save triggers the same transactional projection refresh as a host save.
    const settings = sharedMatchSettingsSchema.parse({
        createParticipantRoles: false,
        attendanceReminderHours: [],
        signupGroupLimits: [],
        registrationStart,
    })
    await invoke(shared.configureLocal, ctx, {
        ...scope,
        guildId: guestGuild,
        eventId: localId,
        ...settings,
    })
    assert.equal(
        (await ctx.db.get(localId))?.registrationStart,
        registrationStart
    )
    await assert.rejects(
        invoke(shared.configureLocal, ctx, {
            ...scope,
            guildId: guestGuild,
            eventId: localId,
            ...settings,
            registrationStart: local!.registrationEnd,
        }),
        /before/
    )
    // Re-open the invitation only in the fake database to exercise acceptance rejection.
    await ctx.db.patch(invitationId, { status: "pending" })
    await assert.rejects(
        invoke(shared.respond, ctx, {
            ...scope,
            guildId: guestGuild,
            invitationId,
            accept: true,
            registrationStart: "invalid",
        }),
        /before/
    )
})

test("each clan's match image carries only the other accepted clans as partner badges", async () => {
    const { ctx, localId } = await fixture()
    const host = await invoke(discordSync.getEventSyncContext, ctx, {
        secret,
        eventId: "events:host",
    })
    const guest = await invoke(discordSync.getEventSyncContext, ctx, {
        secret,
        eventId: localId,
    })
    assert.deepEqual(
        host.event.sharedClans.map((clan: { name: string }) => clan.name),
        ["Guest"]
    )
    assert.deepEqual(
        guest.event.sharedClans.map((clan: { name: string }) => clan.name),
        ["Host"]
    )
    for (const [eventId, guildId, partner] of [
        ["events:host", hostGuild, "Guest"],
        [localId, guestGuild, "Host"],
    ]) {
        const image = await invoke(announcements.getImageContext, ctx, {
            secret,
            eventId,
            guildId,
            result: false,
        })
        assert.equal(image.model.supportingClans[0].name, partner)
        assert.equal(
            image.model.clanName,
            guildId === hostGuild ? "Host" : "Guest"
        )
    }
})

test("an expired pending invitation can still be declined to clear manager notifications", async () => {
    const { ctx, scope, invitationId } = await fixture()
    await ctx.db.patch(invitationId, { status: "pending" })
    await ctx.db.patch("events:host", { status: "concluded" })
    await invoke(shared.respond, ctx, {
        ...scope,
        guildId: guestGuild,
        invitationId,
        accept: false,
    })
    assert.equal((await ctx.db.get(invitationId))?.status, "declined")
    const invitations = await invoke(shared.list, ctx, {
        ...scope,
        guildId: guestGuild,
    })
    assert.equal(invitations.incoming.length, 0)
})

test("roster clan choices include names and logos while player identities retain their owner", async () => {
    const { ctx, scope } = await fixture()
    await ctx.db.patch("guilds:admin", {
        avatar: "https://cdn.discordapp.com/icons/host/logo.png",
    })
    await ctx.db.patch("guilds:guest", {
        avatar: "https://cdn.discordapp.com/icons/guest/logo.png",
    })
    const context = await invoke(shared.rosterContext, ctx, {
        ...scope,
        eventId: "events:host",
    })
    assert.deepEqual(
        context.clans.map((clan: { name: string; avatar?: string }) => ({
            name: clan.name,
            avatar: clan.avatar,
        })),
        [
            {
                name: "Host",
                avatar: "https://cdn.discordapp.com/icons/host/logo.png",
            },
            {
                name: "Guest",
                avatar: "https://cdn.discordapp.com/icons/guest/logo.png",
            },
        ]
    )
    assert.equal(
        context.users.find(
            (user: { discordId: string }) => user.discordId === guestPlayer
        )?.sharedGuildId,
        guestGuild
    )
    assert.equal(
        context.users.find(
            (user: { discordId: string }) => user.discordId === hostPlayer
        )?.sharedGuildId,
        hostGuild
    )
})

test("guest roster badges identify visible foreign players without exposing the foreign reserve pool", async () => {
    const { ctx, scope, localId } = await fixture()
    await ctx.db.patch(`users:${hostPlayer}`, { note: "Private host note" })
    ctx.db.seed("users", {
        _id: "users:host-reserve",
        discordId: "host-reserve",
        guildId: hostGuild,
        name: "Host Reserve",
        avatar: "",
        nicknames: {},
        platformIds: [],
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:host-reserve",
        userId: "host-reserve",
        serverId: hostGuild,
        type: "member",
        status: "active",
        gameId: "hell_let_loose",
        createdAt: "2020-01-01T00:00:00Z",
    })
    const context = await invoke(shared.rosterContext, ctx, {
        ...scope,
        guildId: guestGuild,
        eventId: localId,
    })
    const foreign = context.users.find(
        (user: { discordId: string }) => user.discordId === hostPlayer
    )
    assert.equal(foreign?.sharedGuildId, hostGuild)
    assert.equal(foreign?.note, undefined)
    assert.equal(
        context.users.some(
            (user: { discordId: string }) => user.discordId === "host-reserve"
        ),
        false
    )
})
