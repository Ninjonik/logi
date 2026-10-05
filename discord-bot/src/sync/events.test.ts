import { MessageFlags } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

import type {
    EventRecord,
    MatchTeamAssignment,
    Roster,
    SyncPayload,
} from "../types"
import {
    buildAnnouncementMessage,
    buildAnnouncementV2Message,
} from "../message-builders"
import { buildEventMessageContent, getAnnouncementPingRoleIds } from "./events"

const payload = { config: { clanRoleId: "clan-role" } } as SyncPayload

test("getAnnouncementPingRoleIds resolves the configured clan role", () => {
    const event = { pingClan: true, pingMode: "clan" } as EventRecord

    assert.deepEqual(getAnnouncementPingRoleIds(payload, event), ["clan-role"])
})

test("getAnnouncementPingRoleIds resolves and de-duplicates selected roles", () => {
    const event = {
        pingClan: false,
        pingMode: "roles",
        pingRoleIds: ["role-1", "role-1", " role-2 ", ""],
    } as EventRecord

    assert.deepEqual(getAnnouncementPingRoleIds(payload, event), [
        "role-1",
        "role-2",
    ])
})

function toPlainJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as unknown
}

function createMatchTeam(
    slot: MatchTeamAssignment["slot"],
    name: string,
    side: string | null,
    logoUrl: string | null = `https://assets.example.test/${slot}.png`
): MatchTeamAssignment {
    return {
        teamId: `team-${slot}`,
        slot,
        side,
        snapshot: {
            name,
            shortCode: null,
            logoAssetId: logoUrl ? `asset-${slot}` : null,
            logoUrl,
            teamRevision: 2,
            capturedAt: "2026-07-29T09:00:00.000Z",
        },
    }
}

function createMessageFixture(patch: Partial<EventRecord> = {}) {
    const event: EventRecord = {
        id: "event-1",
        guildId: "guild-1",
        kind: "match",
        name: "Native Match",
        map: "foy_warfare",
        side: "Allies",
        imageUrl: "https://example.com/banner.png",
        requiredRoleIds: [],
        rewardRoleIds: [],
        registrationEnd: "2026-07-29T12:30:00.000Z",
        meetingStart: "2026-07-29T13:00:00.000Z",
        gameStart: "2026-07-29T14:00:00.000Z",
        gameEnd: "2026-07-29T16:00:00.000Z",
        pingClan: false,
        createForumChannel: false,
        status: "starting",
        statusUpdatedAt: "2026-07-29T10:00:00.000Z",
        attendanceReminderLog: [],
        signUps: [],
        participants: [],
        updatedAt: "2026-07-29T10:00:00.000Z",
        ...patch,
    }
    const roster: Roster = {
        id: "roster-1",
        eventId: event.id,
        published: true,
        reservePlayerIds: [],
        updatedAt: "2026-07-29T11:00:00.000Z",
        squads: [],
    }
    const fixturePayload = {
        guild: {
            id: "guild-1",
            discordId: "guild-1",
            name: "Guild",
            avatar: "",
            eventCategories: [
                { id: "competitive", label: "Competitive", color: "#dc2626" },
            ],
            calendarItems: [],
            botInside: true,
            adminIds: [],
            memberIds: [],
            mercenaryIds: [],
            updatedAt: "2026-07-29T10:00:00.000Z",
        },
        config: {
            id: "config-1",
            guildId: "guild-1",
            timezone: "Europe/Prague",
            defaultLanguage: "en",
            calendarCategories: [],
            clanRoleId: "clan-role",
            updatedAt: "2026-07-29T10:00:00.000Z",
        },
        groups: [],
        userDisplayNames: {},
        events: [event],
        calendarItems: [],
        rosters: [roster],
        topicPresets: [],
        syncStates: [],
        assignments: [],
    } satisfies SyncPayload
    return { event, payload: fixturePayload }
}

/** The split-channel message content exactly as built before match teams existed. */
function buildPreviousEventMessageContent(input: {
    payload: SyncPayload
    event: EventRecord
    legacyEmbeds: boolean
    includeSignup: boolean
    pingRoleIds: string[]
}) {
    const { payload, event, includeSignup } = input
    if (input.legacyEmbeds) {
        const { embed, components } = buildAnnouncementMessage(
            payload,
            event,
            {},
            { showPublishedRosterImage: !includeSignup }
        )
        return { embeds: [embed], components: includeSignup ? components : [] }
    }
    return {
        ...buildAnnouncementV2Message(
            payload,
            event,
            {},
            {
                showPublishedRosterImage: !includeSignup,
                pingRoleIds: input.pingRoleIds,
            }
        ),
        flags: MessageFlags.IsComponentsV2,
    }
}

test("event messages without team assignments keep the previous payload", () => {
    for (const matchTeams of [undefined, []]) {
        const { payload, event } = createMessageFixture(
            matchTeams ? { matchTeams } : {}
        )
        for (const legacyEmbeds of [true, false]) {
            for (const includeSignup of [true, false]) {
                const pingRoleIds = includeSignup ? ["clan-role"] : []
                assert.deepEqual(
                    toPlainJson(
                        buildEventMessageContent({
                            payload,
                            event,
                            userDisplayNames: {},
                            legacyEmbeds,
                            includeSignup,
                            pingRoleIds,
                        })
                    ),
                    toPlainJson(
                        buildPreviousEventMessageContent({
                            payload,
                            event,
                            legacyEmbeds,
                            includeSignup,
                            pingRoleIds,
                        })
                    ),
                    `matchTeams=${JSON.stringify(matchTeams)} legacy=${legacyEmbeds} signup=${includeSignup}`
                )
            }
        }
    }
})

test("legacy event information messages append one logo embed per assigned team", () => {
    const { payload, event } = createMessageFixture({
        gameId: "hell_let_loose",
        matchTeams: [
            createMatchTeam("b", "Bravo", "Axis"),
            createMatchTeam("a", "Alpha", "Allies"),
        ],
    })
    const content = buildEventMessageContent({
        payload,
        event,
        userDisplayNames: {},
        legacyEmbeds: true,
        includeSignup: false,
        pingRoleIds: [],
    })
    assert.ok(content.embeds)
    const [main, ...teams] = content.embeds.map((embed) => embed.toJSON())
    const previous = buildPreviousEventMessageContent({
        payload,
        event,
        legacyEmbeds: true,
        includeSignup: false,
        pingRoleIds: [],
    })

    assert.ok(previous.embeds)
    assert.deepEqual(toPlainJson(main), toPlainJson(previous.embeds[0]))
    assert.match(
        main?.description ?? "",
        /Foy • Day • Warfare · meeting <t:\d+:t>/
    )
    assert.equal(main?.image?.url?.includes("/roster"), true)
    assert.match(
        main?.description ?? "",
        /🛡️ Teams:\*\* Alpha \(Allies\) vs Bravo \(Axis\)/
    )
    assert.deepEqual(toPlainJson(teams), [
        {
            author: {
                name: "Alpha",
                icon_url: "https://assets.example.test/a.png",
            },
            color: main?.color,
            description: "Allies",
        },
        {
            author: {
                name: "Bravo",
                icon_url: "https://assets.example.test/b.png",
            },
            color: main?.color,
            description: "Axis",
        },
    ])
    assert.deepEqual(content.components, [])
    assert.ok(content.embeds.length <= 10)
})

test("registration cards show team labels but no logo cards", () => {
    const { payload, event } = createMessageFixture({
        status: "registration",
        gameId: "wardogs",
        matchTeams: [
            createMatchTeam("a", "Alpha", "Valkyra"),
            createMatchTeam("b", "Bravo", "Manticore"),
            createMatchTeam("c", "Charlie", "Lonestar"),
        ],
    })
    const legacy = buildEventMessageContent({
        payload,
        event,
        userDisplayNames: {},
        legacyEmbeds: true,
        includeSignup: true,
        pingRoleIds: ["clan-role"],
    })
    assert.ok(legacy.embeds)
    assert.equal(legacy.embeds.length, 1)
    assert.match(
        legacy.embeds[0]?.toJSON().description ?? "",
        /Alpha \(Valkyra\) vs Bravo \(Manticore\) vs Charlie \(Lonestar\)/
    )
    assert.ok(legacy.components.length > 0)

    const v2 = toPlainJson(
        buildEventMessageContent({
            payload,
            event,
            userDisplayNames: {},
            legacyEmbeds: false,
            includeSignup: true,
            pingRoleIds: ["clan-role"],
        })
    )
    assert.doesNotMatch(JSON.stringify(v2), /assets\.example\.test/)
})

test("Components V2 information cards keep controls and add Wardogs team logos", () => {
    const { payload, event } = createMessageFixture({
        gameId: "wardogs",
        matchTeams: [
            createMatchTeam("c", "Charlie", "Lonestar"),
            createMatchTeam("a", "Alpha", "Valkyra"),
            createMatchTeam("b", "Bravo", null, null),
        ],
    })
    const content = buildEventMessageContent({
        payload,
        event,
        userDisplayNames: {},
        legacyEmbeds: false,
        includeSignup: false,
        pingRoleIds: [],
    })
    assert.ok("flags" in content)
    assert.equal(content.flags, MessageFlags.IsComponentsV2)
    const container = toPlainJson(content.components[0]) as {
        components: Array<{
            type: number
            accessory?: { type: number; media: { url: string } }
            components?: Array<{ type: number; custom_id?: string }>
        }>
    }
    const logoSections = container.components.filter(
        (component) => component.type === 9 && component.accessory?.type === 11
    )
    assert.deepEqual(
        logoSections.map((section) => section.accessory?.media.url),
        [
            "https://assets.example.test/a.png",
            "https://assets.example.test/c.png",
        ]
    )
    const last = container.components.at(-1)
    assert.equal(last?.type, 1)
    assert.ok(
        last?.components?.some(
            (button) => button.custom_id === "roster-assignment:event-1"
        )
    )
    const gallery = container.components.find(
        (component) => component.type === 12
    )
    assert.match(JSON.stringify(gallery), /example\.com\/banner\.png/)
    assert.equal(content.components.length, 1)
})
