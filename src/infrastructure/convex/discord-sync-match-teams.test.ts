import assert from "node:assert/strict"
import test from "node:test"

import { invoke, testContext } from "./testing/database"
import { normalizeEventDoc } from "./server-read-model"

const secret = "synthetic-discord-sync-secret"
process.env.INTERNAL_AUTH_SECRET = secret

const matchTeams = [
    {
        teamId: "teamDirectory:alpha",
        slot: "a" as const,
        side: "Allies",
        snapshot: {
            name: "Alpha",
            shortCode: "ALP",
            logoAssetId: "imageAssets:alpha",
            logoUrl: "https://assets.example.test/alpha.png",
            teamRevision: 3,
            capturedAt: "2026-07-29T09:00:00.000Z",
        },
    },
    {
        teamId: "teamDirectory:bravo",
        slot: "b" as const,
        side: null,
        snapshot: {
            name: "Bravo",
            shortCode: null,
            logoAssetId: null,
            logoUrl: null,
            teamRevision: 1,
            capturedAt: "2026-07-29T09:00:00.000Z",
        },
    },
]

const eventRow = {
    _id: "events:native",
    guildId: "guild-a",
    gameId: "hell_let_loose" as const,
    kind: "match" as const,
    name: "Native match",
    requiredRoleIds: [],
    rewardRoleIds: [],
    registrationEnd: "2099-07-29T12:30:00.000Z",
    meetingStart: "2099-07-29T13:00:00.000Z",
    gameStart: "2099-07-29T14:00:00.000Z",
    gameEnd: "2099-07-29T16:00:00.000Z",
    pingClan: false,
    createForumChannel: false,
    status: "registration" as const,
    statusUpdatedAt: "2026-07-29T10:00:00.000Z",
    attendanceReminderLog: [],
    signUps: [],
    participants: [],
    matchTeams,
    createdAt: "2026-07-29T10:00:00.000Z",
    updatedAt: "2026-07-29T10:00:00.000Z",
}

function seededContext() {
    const ctx = testContext()
    ctx.db.seed("events", structuredClone(eventRow))
    ctx.db.seed("events", {
        ...structuredClone(eventRow),
        _id: "events:legacy",
        name: "Legacy match",
        matchTeams: undefined,
    })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:a",
        guildId: "guild-a",
        timezone: "Europe/Prague",
        defaultLanguage: "en",
        calendarCategories: [],
        updatedAt: "2026-07-29T10:00:00.000Z",
    })
    ctx.db.seed("guilds", {
        _id: "guilds:a",
        discordId: "guild-a",
        name: "Guild A",
        avatar: "",
        botInside: true,
        adminIds: [],
        memberIds: [],
        mercenaryIds: [],
        updatedAt: "2026-07-29T10:00:00.000Z",
    })
    return ctx
}

test("normalizeEventDoc passes stored match team snapshots through unchanged", () => {
    const normalized = normalizeEventDoc(structuredClone(eventRow))

    assert.deepEqual(normalized.matchTeams, matchTeams)
    assert.equal(
        normalizeEventDoc({
            ...structuredClone(eventRow),
            matchTeams: undefined,
        }).matchTeams,
        undefined
    )
})

test("every Discord bot event payload query carries matchTeams", async () => {
    const discord = await import("../../../convex/discordSync")
    const ctx = seededContext()

    const syncContext = await invoke(discord.getEventSyncContext, ctx, {
        secret,
        eventId: "events:native",
    })
    assert.deepEqual(syncContext.event.matchTeams, matchTeams)

    const [payload] = await invoke(discord.listSyncPayloads, ctx, { secret })
    const byId = new Map(
        payload.events.map((event: { id: string }) => [event.id, event])
    )
    assert.deepEqual(
        (byId.get("events:native") as { matchTeams?: unknown }).matchTeams,
        matchTeams
    )
    assert.equal(
        (byId.get("events:legacy") as { matchTeams?: unknown }).matchTeams,
        undefined
    )

    const signup = await invoke(discord.getEventSignupContext, ctx, {
        secret,
        guildId: "guild-a",
        eventId: "events:native",
    })
    assert.deepEqual(signup.event.matchTeams, matchTeams)

    const interaction = await invoke(discord.getEventInteractionContext, ctx, {
        secret,
        eventId: "events:native",
    })
    assert.deepEqual(interaction.event.matchTeams, matchTeams)
})

test("the interaction context carries the event category colour", async () => {
    const discord = await import("../../../convex/discordSync")
    const ctx = seededContext()
    await ctx.db.patch("guilds:a", {
        eventCategories: [
            { id: "friendly", label: "Friendly", color: "#dc2626" },
        ],
    })
    await ctx.db.patch("events:native", { matchType: " Friendly " })
    const colour = async (eventId: string) =>
        (
            await invoke(discord.getEventInteractionContext, ctx, {
                secret,
                eventId,
            })
        ).categoryColor
    assert.equal(await colour("events:native"), "#dc2626")
    assert.equal(await colour("events:legacy"), null)
})

test("the bot's event payloads carry the competition round (L3-14)", async () => {
    const discord = await import("../../../convex/discordSync")
    const ctx = seededContext()
    ctx.db.seed("competitionFixtures", {
        _id: "competitionFixtures:1",
        competitionId: "competitions:ecl",
        phase: "league",
        round: 3,
        status: "scheduled",
        eventId: "events:native",
        createdAt: "2026-07-29T10:00:00.000Z",
        updatedAt: "2026-07-29T10:00:00.000Z",
    })
    const syncContext = await invoke(discord.getEventSyncContext, ctx, {
        secret,
        eventId: "events:native",
    })
    assert.equal(syncContext.event.competitionRound, 3)
    const legacy = await invoke(discord.getEventSyncContext, ctx, {
        secret,
        eventId: "events:legacy",
    })
    assert.equal(legacy.event.competitionRound, undefined)
    const [payload] = await invoke(discord.listSyncPayloads, ctx, { secret })
    const byId = new Map(
        payload.events.map(
            (event: { id: string; competitionRound?: number }) => [
                event.id,
                event.competitionRound,
            ]
        )
    )
    assert.equal(byId.get("events:native"), 3)
    assert.equal(byId.get("events:legacy"), undefined)
})
