import { isHistoricalConcludedEvent } from "../../application/discord-sync/relevance"
import { invoke, spyReads, testContext } from "./testing/database"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

/**
 * The bot's subscriptions over the fake database: they read only the events
 * the bot acts on, through `status_gameEnd`, and the rows that belong to
 * them through `eventId`, never a whole table (ARCHITECTURE.md, "Convex hot
 * paths"). The rule itself (`isHistoricalConcludedEvent`) stays with the
 * bot; the read only bounds it, with a day of slack.
 */

const secret = ["synthetic", "discord", "sync", "secret"].join("-")
const NOW = Date.parse("2026-10-06T12:00:00.000Z")

function eventRow(
    id: string,
    fields: {
        guildId?: string
        status?: "registration" | "closed" | "starting" | "concluded"
        gameEnd: string
        isDraft?: boolean
        signUps?: Array<{ userId: string }>
    }
) {
    return {
        _id: `events:${id}`,
        guildId: fields.guildId ?? "guild-a",
        gameId: "hell_let_loose" as const,
        kind: "match" as const,
        name: id,
        requiredRoleIds: [],
        rewardRoleIds: [],
        registrationEnd: fields.gameEnd,
        meetingStart: fields.gameEnd,
        gameStart: fields.gameEnd,
        gameEnd: fields.gameEnd,
        pingClan: false,
        createForumChannel: false,
        ...(fields.status ? { status: fields.status } : {}),
        ...(fields.isDraft ? { isDraft: true } : {}),
        attendanceReminderLog: [],
        signUps: fields.signUps ?? [],
        participants: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    }
}

function fixture(t: TestContext) {
    process.env.INTERNAL_AUTH_SECRET = secret
    t.mock.timers.enable({ apis: ["Date"], now: NOW })
    const ctx = testContext()
    for (const row of [
        eventRow("upcoming", {
            status: "registration",
            gameEnd: "2026-10-20T20:00:00.000Z",
            signUps: [{ userId: "user-1" }],
        }),
        eventRow("closed", {
            status: "closed",
            gameEnd: "2026-10-07T20:00:00.000Z",
        }),
        eventRow("starting", {
            status: "starting",
            gameEnd: "2026-10-06T14:00:00.000Z",
        }),
        // Never concluded, a year old: the bot still acts on it.
        eventRow("old-open", {
            status: "registration",
            gameEnd: "2025-10-01T20:00:00.000Z",
        }),
        // A legacy row without a status.
        eventRow("legacy", { gameEnd: "2024-01-01T20:00:00.000Z" }),
        // Concluded six days ago: still in the bot's window.
        eventRow("recent-concluded", {
            status: "concluded",
            gameEnd: "2026-09-30T12:00:00.000Z",
        }),
        // Concluded seven and a half days ago: inside the read's slack, but
        // historical for the bot.
        eventRow("edge-concluded", {
            status: "concluded",
            gameEnd: "2026-09-29T00:00:00.000Z",
        }),
        // Concluded eight days ago: never read.
        eventRow("archived", {
            status: "concluded",
            gameEnd: "2026-09-28T11:00:00.000Z",
        }),
        eventRow("draft", {
            status: "registration",
            gameEnd: "2026-10-20T20:00:00.000Z",
            isDraft: true,
        }),
        eventRow("other-guild", {
            guildId: "guild-b",
            status: "registration",
            gameEnd: "2026-10-20T20:00:00.000Z",
        }),
    ])
        ctx.db.seed("events", row)
    for (const id of ["upcoming", "legacy", "archived"])
        ctx.db.seed("rosters", {
            _id: `rosters:${id}`,
            eventId: `events:${id}`,
            guildId: "guild-a",
            squads:
                id === "upcoming"
                    ? [
                          {
                              name: "Able",
                              group: "infantry",
                              order: 0,
                              color: "#fff",
                              players: [{ id: "user-2", ack: true }],
                          },
                      ]
                    : [],
            reservePlayerIds: id === "upcoming" ? ["user-5"] : [],
            notAttendingPlayerIds: [],
            updatedAt: "2026-01-02T00:00:00.000Z",
        })
    // The people the payload names: a signed-up member with a clan nickname,
    // a rostered legacy user known by Discord ID only, an assignee on no
    // event and a member of no clan the events name.
    for (const row of [
        {
            _id: "users:1",
            id: "user-1",
            discordId: "user-1",
            name: "Alpha",
            nicknames: { "guild-a": " Alpha of A " },
        },
        { _id: "users:2", discordId: "user-2", name: "Bravo" },
        { _id: "users:3", id: "user-3", discordId: "user-3", name: "Charlie" },
        { _id: "users:9", id: "user-9", discordId: "user-9", name: "Zulu" },
    ])
        ctx.db.seed("users", {
            avatar: "",
            managedGuildIds: [],
            mercenaryGuildIds: [],
            isStreamer: false,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            ...row,
        })
    for (const id of ["upcoming", "archived"])
        ctx.db.seed("discordEventSyncs", {
            _id: `discordEventSyncs:${id}`,
            eventId: `events:${id}`,
            guildId: "guild-a",
            topicMessageIds: [],
            lastSyncedAt: "2026-01-02T00:00:00.000Z",
            createdAt: "2026-01-02T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
        })
    ctx.db.seed("competitionFixtures", {
        _id: "competitionFixtures:upcoming",
        competitionId: "competitions:ecl",
        eventId: "events:upcoming",
        round: 2,
    })
    ctx.db.seed("competitionFixtures", {
        _id: "competitionFixtures:archived",
        competitionId: "competitions:ecl",
        eventId: "events:archived",
        round: 1,
    })
    for (const [guildId, userId] of [
        ["guild-a", "user-1"],
        ["guild-a", "user-2"],
        ["guild-b", "user-3"],
    ])
        ctx.db.seed("userAssignments", {
            _id: `userAssignments:${userId}`,
            userId,
            serverId: guildId,
            gameId: "hell_let_loose",
            type: "member",
            status: "active",
            paused: false,
            primaryGroupId: "groups:infantry",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        })
    for (const guildId of ["guild-a", "guild-b"]) {
        ctx.db.seed("discordConfigs", {
            _id: `discordConfigs:${guildId}`,
            guildId,
            timezone: "Europe/Prague",
            defaultLanguage: "cs",
            calendarCategories: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
        })
        ctx.db.seed("guilds", {
            _id: `guilds:${guildId}`,
            discordId: guildId,
            name: guildId,
            avatar: "",
            botInside: true,
            adminIds: [],
            memberIds: [],
            mercenaryIds: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
        })
    }
    return ctx
}

const indexesOf = (
    calls: ReturnType<typeof spyReads>,
    table: string
): Array<string | null> => [
    ...new Set(
        calls.filter((call) => call.table === table).map((call) => call.index)
    ),
]

type Payload = {
    config: { guildId: string }
    events: Array<{ id: string; competitionRound?: number }>
    syncStates: Array<{ id: string }>
    rosters: Array<{ id: string }>
    assignments: unknown[]
    userDisplayNames: Record<string, string>
}

const botEventIds = [
    "events:closed",
    "events:edge-concluded",
    "events:legacy",
    "events:old-open",
    "events:other-guild",
    "events:recent-concluded",
    "events:starting",
    "events:upcoming",
]

test("the event index reads the events the bot acts on through status_gameEnd and their rosters through eventId", async (t) => {
    const discord = await import("../../../convex/discordSync")
    const ctx = fixture(t)
    const calls = spyReads(ctx)
    const index = await invoke(discord.listEventSyncIndex, ctx, { secret })

    assert.deepEqual(
        index.events.map((event: { id: string }) => event.id).sort(),
        botEventIds
    )
    // The read bounds with a day of slack; the bot's rule decides exactly,
    // on the normalized status, which the schedule advances: a never
    // concluded event whose end is long past reads as concluded too, so the
    // bot left it alone before this bound and still does.
    assert.deepEqual(
        index.events
            .filter(
                (event: { status?: string; gameEnd: string }) =>
                    !isHistoricalConcludedEvent(event, new Date())
            )
            .map((event: { id: string }) => event.id)
            .sort(),
        botEventIds.filter(
            (id) =>
                ![
                    "events:edge-concluded",
                    "events:legacy",
                    "events:old-open",
                ].includes(id)
        )
    )
    assert.deepEqual(
        index.rosters
            .map((roster: { eventId: string }) => roster.eventId)
            .sort(),
        ["events:legacy", "events:upcoming"]
    )
    assert.deepEqual(indexesOf(calls, "events"), ["status_gameEnd"])
    assert.deepEqual(indexesOf(calls, "rosters"), ["eventId"])
})

test("the event index needs the internal secret", async (t) => {
    const discord = await import("../../../convex/discordSync")
    const ctx = fixture(t)
    await assert.rejects(
        invoke(discord.listEventSyncIndex, ctx, { secret: "wrong" })
    )
})

test("the sync payloads bound events the same way and read sync states, rosters, fixtures and assignments through their indexes", async (t) => {
    const discord = await import("../../../convex/discordSync")
    const ctx = fixture(t)
    const calls = spyReads(ctx)
    const payloads: Payload[] = await invoke(discord.listSyncPayloads, ctx, {
        secret,
    })
    const byGuild = new Map(
        payloads.map((payload) => [payload.config.guildId, payload])
    )
    const guildA = byGuild.get("guild-a")
    const guildB = byGuild.get("guild-b")
    assert.ok(guildA && guildB)
    assert.deepEqual(
        guildA.events.map((event) => event.id).sort(),
        botEventIds.filter((id) => id !== "events:other-guild")
    )
    assert.equal(
        guildA.events.find((event) => event.id === "events:upcoming")
            ?.competitionRound,
        2
    )
    assert.deepEqual(
        guildA.syncStates.map((state) => state.id),
        ["discordEventSyncs:upcoming"]
    )
    assert.deepEqual(guildA.rosters.map((roster) => roster.id).sort(), [
        "rosters:legacy",
        "rosters:upcoming",
    ])
    assert.deepEqual(guildA.assignments, [
        {
            userId: "user-1",
            type: "member",
            status: "active",
            gameId: "hell_let_loose",
        },
        {
            userId: "user-2",
            type: "member",
            status: "active",
            gameId: "hell_let_loose",
        },
    ])
    assert.deepEqual(
        guildB.events.map((event) => event.id),
        ["events:other-guild"]
    )
    assert.deepEqual(guildB.assignments, [
        {
            userId: "user-3",
            type: "member",
            status: "active",
            gameId: "hell_let_loose",
        },
    ])
    assert.deepEqual(indexesOf(calls, "events"), ["status_gameEnd"])
    assert.deepEqual(indexesOf(calls, "rosters"), ["eventId"])
    assert.deepEqual(indexesOf(calls, "discordEventSyncs"), ["eventId"])
    assert.deepEqual(indexesOf(calls, "competitionFixtures"), ["eventId"])
    assert.deepEqual(indexesOf(calls, "userAssignments"), ["serverId"])
})

test("the sync payloads name the people the events and rosters reference, read through the users indexes and never as a whole table", async (t) => {
    const discord = await import("../../../convex/discordSync")
    const ctx = fixture(t)
    const calls = spyReads(ctx)
    const payloads: Payload[] = await invoke(discord.listSyncPayloads, ctx, {
        secret,
    })
    const guildA = payloads.find(
        (payload) => payload.config.guildId === "guild-a"
    )
    const guildB = payloads.find(
        (payload) => payload.config.guildId === "guild-b"
    )
    assert.ok(guildA && guildB)
    // The signed-up member under the clan nickname, the rostered legacy
    // user under both of its identifiers; the reserve without a user row,
    // the assignee on no event and the unreferenced member are absent.
    assert.deepEqual(guildA.userDisplayNames, {
        "user-1": "Alpha of A",
        "user-2": "Bravo",
    })
    assert.deepEqual(guildB.userDisplayNames, {})
    const userReads = calls.filter((call) => call.table === "users")
    assert.ok(userReads.length > 0)
    assert.deepEqual([...new Set(userReads.map((call) => call.index))].sort(), [
        "discordId",
        "id",
    ])
})

test("the guild cache snapshot reads neither events nor assignments", async (t) => {
    const discord = await import("../../../convex/discordSync")
    const ctx = fixture(t)
    const calls = spyReads(ctx)
    const snapshot = await invoke(discord.listGuildCacheSnapshot, ctx, {
        secret,
    })
    assert.deepEqual(
        snapshot.configs
            .map((config: { guildId: string }) => config.guildId)
            .sort(),
        ["guild-a", "guild-b"]
    )
    assert.equal("assignments" in snapshot, false)
    assert.deepEqual([...new Set(calls.map((call) => call.table))].sort(), [
        "calendarItems",
        "discordConfigs",
        "groups",
        "guilds",
        "squadPresets",
        "topicPresets",
    ])
})

test("a clan's assignments for a reminder are read through serverId", async (t) => {
    const discord = await import("../../../convex/discordSync")
    const ctx = fixture(t)
    const calls = spyReads(ctx)
    const assignments = await invoke(discord.listGuildAssignments, ctx, {
        secret,
        guildId: "guild-b",
    })
    assert.deepEqual(assignments, [
        {
            userId: "user-3",
            type: "member",
            status: "active",
            gameId: "hell_let_loose",
        },
    ])
    assert.deepEqual(indexesOf(calls, "userAssignments"), ["serverId"])
    await assert.rejects(
        invoke(discord.listGuildAssignments, ctx, {
            secret: "wrong",
            guildId: "guild-b",
        })
    )
})
