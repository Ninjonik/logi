import assert from "node:assert/strict"
import test from "node:test"

import {
    buildAnnouncementV2Message,
    buildAttendanceReminderComponents,
    buildCalendarPanelEmbed,
    buildEventComponents,
    buildEventEmbed,
    buildMatchTeamLogoEmbeds,
    buildMatchTeamV2Sections,
    buildRosterSummaryText,
    escapeMatchTeamText,
} from "./message-builders"
import type {
    CalendarItem,
    DiscordConfig,
    EventCategory,
    EventRecord,
    Group,
    MatchTeamAssignment,
    Roster,
    SyncPayload,
} from "./types"

const config: DiscordConfig = {
    id: "config-1",
    guildId: "guild-1",
    timezone: "Europe/Berlin",
    defaultLanguage: "cs",
    calendarCategories: [],
    updatedAt: "2026-07-29T10:00:00.000Z",
}

const groups: Group[] = [
    {
        id: "command",
        guildId: "guild-1",
        name: "Command",
        color: "#d4a017",
        updatedAt: "2026-07-29T10:00:00.000Z",
    },
    {
        id: "inf",
        guildId: "guild-1",
        name: "Infantry",
        color: "#dc2626",
        updatedAt: "2026-07-29T10:00:00.000Z",
    },
]

const eventCategories: EventCategory[] = [
    {
        id: "competitive",
        label: "Competitive",
        color: "#dc2626",
    },
]

function createMatchEvent(patch: Partial<EventRecord> = {}): EventRecord {
    return {
        id: "event-1",
        guildId: "guild-1",
        kind: "match",
        name: "Test Match",
        requiredRoleIds: [],
        rewardRoleIds: [],
        registrationEnd: "2026-07-29T12:30:00.000Z",
        meetingStart: "2026-07-29T13:00:00.000Z",
        gameStart: "2026-07-29T14:00:00.000Z",
        gameEnd: "2026-07-29T16:00:00.000Z",
        pingClan: false,
        createForumChannel: false,
        status: "registration",
        statusUpdatedAt: "2026-07-29T10:00:00.000Z",
        attendanceReminderLog: [],
        signUps: [],
        participants: [],
        updatedAt: "2026-07-29T10:00:00.000Z",
        ...patch,
    }
}

function createTrainingEvent(patch: Partial<EventRecord> = {}): EventRecord {
    return {
        ...createMatchEvent({
            kind: "training",
            name: "Test Training",
            signupGroupIds: [],
            participants: [],
            signUps: [],
        }),
        ...patch,
    }
}

function futureIso(days: number, hours = 0) {
    return new Date(
        Date.now() + days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000
    ).toISOString()
}

test("buildEventComponents omits group buttons when signupGroupIds is empty", () => {
    const rows = buildEventComponents(
        config,
        groups,
        createMatchEvent({
            signupGroupIds: [],
            useGeneralSignup: true,
        })
    )

    const buttons = rows.flatMap((row) => row.toJSON().components)
    assert.deepEqual(
        buttons.map((button) => ("label" in button ? button.label : undefined)),
        ["Přihlásit se", "Moje přihláška", "Nepřijdu", "Do kalendáře"]
    )
    assert.deepEqual(
        buttons.map((button) => button.style),
        [3, 2, 4, 5]
    )
    // Colour carries the meaning; the buttons have no decorative emoji.
    assert.equal(
        buttons.some((button) => "emoji" in button && button.emoji),
        false
    )
})

test("announcements count sign-ups instead of listing names", () => {
    const embed = buildEventEmbed(
        config,
        groups,
        eventCategories,
        createMatchEvent({
            signupGroupIds: [],
            participants: [
                {
                    userId: "user-1",
                    status: "not_attending",
                    updatedAt: "2026-07-29T10:00:00.000Z",
                },
                {
                    userId: "user-2",
                    status: "attending",
                    updatedAt: "2026-07-29T10:00:00.000Z",
                },
            ],
        }),
        undefined,
        { "user-1": "Alpha Nick", "user-2": "Bravo Nick" }
    ).toJSON()

    assert.equal(embed.fields, undefined)
    assert.match(
        embed.description ?? "",
        /\*\*Přihlášeno 1\*\* · Bez skupiny 1/
    )
    assert.doesNotMatch(JSON.stringify(embed), /Alpha Nick|Bravo Nick|<@/)
})

test("training cards show the start and a plain sign-up count", () => {
    const description =
        buildEventEmbed(
            config,
            groups,
            eventCategories,
            createTrainingEvent({
                participants: [
                    {
                        userId: "user-1",
                        status: "attending",
                        updatedAt: "2026-07-29T10:00:00.000Z",
                    },
                ],
            })
        ).toJSON().description ?? ""

    assert.match(description, /^\*\*<t:1785333600:F>\*\*$/m)
    assert.match(description, /^\*\*Přihlášeno 1\*\*$/m)
    assert.doesNotMatch(description, /Command|Infantry|Strana/)
})

test("buildEventEmbed shows the start, map, meeting and sign-up deadline as Discord times", () => {
    const embed = buildEventEmbed(
        { ...config, defaultLanguage: "en" },
        groups,
        eventCategories,
        createMatchEvent({
            map: "foy_warfare",
            cap: "50",
            matchType: "competitive",
            side: "Allies",
        })
    ).toJSON()
    const [header] = (embed.description ?? "").split(/\n-{20,}\n/)

    assert.equal(embed.title, "Test Match · Competitive")
    assert.equal(embed.color, 0xdc2626)
    assert.equal(
        header,
        [
            "**Side:** ★ Allies",
            "**<t:1785333600:F>**",
            "Foy · day · Cap 50 · meeting <t:1785330000:t> · sign-ups close <t:1785328200:R>",
        ].join("\n")
    )
    assert.doesNotMatch(embed.description ?? "", /🗺️|🎮|🔒|📌|👥|🏷️|🛡️/)
    // Once registration closes the status says so; no past deadline.
    const closed =
        buildEventEmbed(
            { ...config, defaultLanguage: "en" },
            groups,
            eventCategories,
            createMatchEvent({ status: "closed" })
        ).toJSON().description ?? ""
    assert.doesNotMatch(closed, /sign-ups close/)
    assert.match(closed, /Status: Closed/)
})

test("map labels use the clan language and name non-warfare modes", () => {
    const describe = (map: string, language: "cs" | "de") =>
        (
            buildEventEmbed(
                { ...config, defaultLanguage: language },
                groups,
                eventCategories,
                createMatchEvent({ map })
            ).toJSON().description ?? ""
        ).split("\n")[1]
    assert.match(describe("foy_warfare_night", "cs") ?? "", /^Foy · noc · sraz/)
    assert.match(
        describe("foy_offensive_ger", "de") ?? "",
        /^Foy · Tag · Offensive · Treffen/
    )
    assert.match(
        describe("Custom *map*", "cs") ?? "",
        /^Custom \\\*map\\\* · sraz/
    )
})

test("buildEventEmbed uses the clan colour and icon density of the message style", () => {
    const styled = {
        ...config,
        defaultLanguage: "en" as const,
        messageStyle: { accentColor: "#5865F2", iconDensity: "rich" as const },
    }
    const plain = buildEventEmbed(
        styled,
        groups,
        eventCategories,
        createMatchEvent({ map: "Foy", side: "Allies" })
    ).toJSON()
    // Without a category the clan colour is the accent.
    assert.equal(plain.color, 0x5865f2)
    const [header] = (plain.description ?? "").split(/\n-{20,}\n/)
    // Rich icons lead the sides, start, details and sign-up lines.
    assert.match(header ?? "", /^⚔️ \*\*Side:\*\* .*Allies$/m)
    assert.match(header ?? "", /^🕒 \*\*<t:\d+:F>\*\*$/m)
    assert.match(header ?? "", /^🗺️ Foy · /m)
    assert.match(plain.description ?? "", /^📋 \*\*Signed up 0\*\*/m)

    // An event category keeps its own colour.
    assert.equal(
        buildEventEmbed(
            styled,
            groups,
            eventCategories,
            createMatchEvent({ matchType: "competitive" })
        ).toJSON().color,
        0xdc2626
    )

    // The sparse style, also the default, has no line icons.
    const sparse = buildEventEmbed(
        {
            ...styled,
            messageStyle: { accentColor: "#5865F2", iconDensity: "sparse" },
        },
        groups,
        eventCategories,
        createMatchEvent({ map: "Foy", side: "Allies" })
    ).toJSON()
    assert.doesNotMatch(sparse.description ?? "", /⚔️|🕒|🗺️|📋/)
    assert.equal(
        buildEventEmbed(
            config,
            groups,
            eventCategories,
            createMatchEvent()
        ).toJSON().color,
        0xe8a33d
    )
})

test("public event cards never contain the server or its password", () => {
    const event = createMatchEvent({
        server: "VLK Scrim",
        serverPassword: "synthetic-private",
    })
    const roster: Roster = {
        id: "roster-1",
        eventId: event.id,
        published: true,
        reservePlayerIds: [],
        updatedAt: "2026-07-29T10:00:00.000Z",
        squads: [],
    }
    const payload = {
        config,
        groups,
        guild: { eventCategories },
        rosters: [roster],
        userDisplayNames: {},
    } as unknown as SyncPayload

    for (const rendered of [
        buildEventEmbed(config, groups, eventCategories, event).toJSON(),
        buildEventEmbed(
            config,
            groups,
            eventCategories,
            event,
            roster,
            {},
            {
                showPublishedRosterImage: true,
            }
        ).toJSON(),
        buildAnnouncementV2Message(
            payload,
            event,
            {}
        ).components?.[0]?.toJSON(),
        buildAnnouncementV2Message(
            payload,
            event,
            {},
            {
                showPublishedRosterImage: true,
            }
        ).components?.[0]?.toJSON(),
    ]) {
        const json = JSON.stringify(rendered)
        assert.doesNotMatch(json, /synthetic-private/)
        assert.doesNotMatch(json, /VLK Scrim/)
    }
    // Trainings have no private assignment, so their server stays visible.
    assert.match(
        buildEventEmbed(
            config,
            groups,
            eventCategories,
            createTrainingEvent({
                server: "Training Server",
                serverPassword: "secret",
            })
        ).toJSON().description ?? "",
        /Training Server/
    )
    assert.doesNotMatch(
        JSON.stringify(
            buildEventEmbed(
                config,
                groups,
                eventCategories,
                createTrainingEvent({ serverPassword: "secret" })
            ).toJSON()
        ),
        /secret/
    )
})

test("sign-up counts list each offered group with its cap", () => {
    const attending = (userId: string, group: string) => ({
        userId,
        status: "attending" as const,
        group,
        updatedAt: "2026-07-29T10:00:00.000Z",
    })
    const event = createMatchEvent({
        signupGroupIds: ["command", "inf"],
        participants: [
            attending("one", "inf"),
            attending("two", "inf"),
            attending("three", "command"),
            {
                userId: "four",
                status: "not_attending",
                updatedAt: "2026-07-29T10:00:00.000Z",
            },
        ],
    })
    const withLimits = {
        ...event,
        signupGroupLimits: [{ groupId: "command", max: 1 }],
    } as EventRecord
    const description = (value: EventRecord) =>
        buildEventEmbed(
            { ...config, defaultLanguage: "en" },
            groups,
            eventCategories,
            value
        ).toJSON().description ?? ""

    assert.match(
        description(withLimits),
        /^\*\*Signed up 3\*\* · Command 1\/1 · Infantry 2$/m
    )
    // Without caps (or with a malformed field) the counts stay plain.
    assert.match(
        description(event),
        /^\*\*Signed up 3\*\* · Command 1 · Infantry 2$/m
    )
    assert.match(
        description({ ...event, signupGroupLimits: "6" } as EventRecord),
        /Command 1 · Infantry 2$/m
    )
    assert.doesNotMatch(description(event), /Status:/)
})

test("buildEventEmbed links the event-specific forum channel when available", () => {
    const description = buildEventEmbed(
        { ...config, defaultLanguage: "en" },
        groups,
        eventCategories,
        createMatchEvent(),
        undefined,
        {},
        { forumChannelId: "forum-123" }
    ).toJSON().description

    assert.match(description ?? "", /^-# <#forum-123> · Managed in Logi$/m)
})

test("buildCalendarPanelEmbed does not repeat a category emoji when it is the color chip", () => {
    const embed = buildCalendarPanelEmbed(
        { ...config, defaultLanguage: "en" },
        [{ id: "friendly", label: "Friendly", color: "#22c55e", emoji: "🟩" }],
        [
            createMatchEvent({
                matchType: "friendly",
                meetingStart: "2099-01-01T19:00:00.000Z",
                gameStart: "2099-01-01T20:00:00.000Z",
                gameEnd: "2099-01-01T21:30:00.000Z",
            }),
        ]
    )

    assert.match(embed.toJSON().description ?? "", /🟩 Friendly/)
    assert.doesNotMatch(embed.toJSON().description ?? "", /🟩 🟩 Friendly/)
})

test("buildCalendarPanelEmbed renders chronicle-style grouped rows with matched color chips", () => {
    const embed = buildCalendarPanelEmbed(
        config,
        [
            {
                id: "competitive",
                label: "Kompetitivní zápas",
                color: "#dc2626",
                emoji: "ðŸ†",
            },
        ],
        [
            createMatchEvent({
                id: "event-red",
                name: "Registrace do aktivního výběru",
                matchType: "competitive",
                meetingStart: futureIso(1),
                gameStart: futureIso(1),
                gameEnd: futureIso(1, 1),
            }),
        ],
        [
            {
                id: "calendar-green",
                guildId: "guild-1",
                title: "VLK vs 57TH - Friendly",
                color: "#22c55e",
                emoji: "ðŸ¤",
                label: "Přátelský zápas",
                startAt: futureIso(2),
                endAt: futureIso(2, 1),
                allDay: false,
                createdAt: "2026-07-29T10:00:00.000Z",
                updatedAt: "2026-07-29T10:00:00.000Z",
            } satisfies CalendarItem,
        ]
    )

    const json = embed.toJSON()
    assert.equal(json.title, "📅 Kalendář")
    assert.match(json.description ?? "", /\*\*Kategorie\*\*/)
    assert.match(json.description ?? "", /🟥 .*Kompetitivní zápas/)
    assert.match(json.description ?? "", /🟩 .*Přátelský zápas/)
    assert.equal((json.description ?? "").match(/\*\*.*20\d\d\*\*/g)?.length, 2)
    assert.match(
        json.description ?? "",
        /🟥 \[Registrace do aktivního výběru\]\(https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/
    )
    assert.match(
        json.description ?? "",
        /🟩 VLK vs 57TH - Friendly <t:\d+:t> - <t:\d+:t>/
    )
})

test("buildCalendarPanelEmbed tolerates missing event categories", () => {
    const embed = buildCalendarPanelEmbed(
        config,
        undefined as unknown as EventCategory[],
        [
            createMatchEvent({
                id: "event-no-categories",
                name: "Fallback Match",
                meetingStart: futureIso(1),
                gameStart: futureIso(1),
                gameEnd: futureIso(1, 1),
            }),
        ],
        []
    )

    const json = embed.toJSON()
    assert.equal(json.title, "📅 Kalendář")
    assert.match(json.description ?? "", /Fallback Match/)
})

test("published roster image keeps its URL for signup-only changes and changes for roster content", () => {
    const roster: Roster = {
        id: "roster-1",
        eventId: "event-1",
        published: true,
        reservePlayerIds: [],
        updatedAt: "2026-07-29T10:00:00.000Z",
        squads: [],
    }
    const event = createMatchEvent({
        status: "closed",
        updatedAt: "2026-07-29T10:00:00.000Z",
    })
    const imageUrl = buildEventEmbed(
        config,
        groups,
        eventCategories,
        event,
        roster,
        {},
        { showPublishedRosterImage: true }
    ).toJSON().image?.url
    const signupOnlyUrl = buildEventEmbed(
        config,
        groups,
        eventCategories,
        {
            ...event,
            updatedAt: "2026-07-29T10:01:00.000Z",
            signUps: [{ userId: "user-1" }],
        },
        roster,
        {},
        { showPublishedRosterImage: true }
    ).toJSON().image?.url
    const rosterChangedUrl = buildEventEmbed(
        config,
        groups,
        eventCategories,
        event,
        { ...roster, updatedAt: "2026-07-29T10:02:00.000Z" },
        {},
        { showPublishedRosterImage: true }
    ).toJSON().image?.url

    assert.equal(signupOnlyUrl, imageUrl)
    assert.notEqual(rosterChangedUrl, imageUrl)
})

test("a published roster keeps the sign-up counts while registration is open", () => {
    const roster: Roster = {
        id: "roster-1",
        eventId: "event-1",
        published: true,
        reservePlayerIds: [],
        updatedAt: "2099-01-01T10:00:00.000Z",
        squads: [],
    }
    const event = createMatchEvent({
        registrationEnd: "2099-01-01T12:30:00.000Z",
        meetingStart: "2099-01-01T13:00:00.000Z",
        gameStart: "2099-01-01T14:00:00.000Z",
        gameEnd: "2099-01-01T16:00:00.000Z",
        signUps: [{ userId: "user-1", group: "Command" }],
    })

    const embed = buildEventEmbed(
        config,
        groups,
        eventCategories,
        event,
        roster,
        { "user-1": "Alpha" }
    ).toJSON()

    assert.match(embed.description ?? "", /\*\*Přihlášeno 1\*\* · Command 1/)
    assert.doesNotMatch(JSON.stringify(embed), /Alpha/)
})

test("Components V2 announcements show published roster below event artwork", () => {
    const event = createMatchEvent({
        imageUrl: "https://example.com/event-artwork.png",
    })
    const roster: Roster = {
        id: "roster-1",
        eventId: event.id,
        published: true,
        reservePlayerIds: [],
        updatedAt: "2026-07-29T10:00:00.000Z",
        squads: [],
    }
    const payload = {
        config,
        groups,
        guild: { eventCategories },
        rosters: [roster],
        userDisplayNames: {},
    } as SyncPayload

    const message = buildAnnouncementV2Message(
        payload,
        event,
        {},
        {
            rosterImageUrl: "attachment://published-roster.png",
        }
    )
    const container = message.components?.[0]?.toJSON()
    const gallery =
        container && "components" in container
            ? container.components.find((component) => "items" in component)
            : undefined

    assert.deepEqual(
        gallery && "items" in gallery
            ? gallery.items.map((item) => item.media.url)
            : [],
        [
            "https://example.com/event-artwork.png",
            "attachment://published-roster.png",
        ]
    )
})

test("Components V2 signup reminders can hide signup details and retain DM-safe controls", () => {
    const event = createMatchEvent({
        participants: [
            {
                userId: "user-1",
                status: "attending",
                updatedAt: "2026-07-29T10:00:00.000Z",
            },
        ],
    })
    const payload = {
        config: { ...config, defaultLanguage: "en" },
        groups,
        guild: { eventCategories },
        rosters: [],
        userDisplayNames: { "user-1": "Alpha" },
        events: [event],
        calendarItems: [],
        topicPresets: [],
        syncStates: [],
        assignments: [],
    } as unknown as SyncPayload

    const message = buildAnnouncementV2Message(
        payload,
        event,
        {},
        {
            hideSignupDetails: true,
            eventLinks: [
                {
                    label: "Open registration channel",
                    url: "https://discord.com/channels/guild-1/registration",
                },
                {
                    label: "Open event forum",
                    url: "https://discord.com/channels/guild-1/forum",
                },
            ],
        }
    )
    const rendered = JSON.stringify(message.components?.[0]?.toJSON())

    assert.match(rendered, /Open registration channel/)
    assert.match(rendered, /Open event forum/)
    assert.doesNotMatch(rendered, /People signed up/)
    assert.doesNotMatch(rendered, /Alpha/)
    assert.match(rendered, /signup:event-1:PRIMARY_GROUP:guild-1/)
    assert.match(rendered, /check-signup:event-1:guild-1/)
})

function createMatchTeam(
    slot: MatchTeamAssignment["slot"],
    name: string,
    patch: {
        side?: string | null
        shortCode?: string | null
        logoUrl?: string | null
    } = {}
): MatchTeamAssignment {
    const logoUrl =
        patch.logoUrl === undefined
            ? `https://assets.example.test/${slot}.png`
            : patch.logoUrl
    return {
        teamId: `team-${slot}`,
        slot,
        side: patch.side ?? null,
        snapshot: {
            name,
            shortCode: patch.shortCode ?? null,
            logoAssetId: logoUrl ? `asset-${slot}` : null,
            logoUrl,
            teamRevision: 1,
            capturedAt: "2026-07-29T09:00:00.000Z",
        },
    }
}

function toPlainJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as unknown
}

function v2Sections(message: ReturnType<typeof buildAnnouncementV2Message>) {
    const container = message.components?.[0]?.toJSON()
    const components =
        container && "components" in container ? container.components : []
    return components.flatMap((component) =>
        "accessory" in component && component.accessory.type === 11
            ? [component]
            : []
    )
}

test("the sides line lists teams by slot with faction emblems", () => {
    const description =
        buildEventEmbed(
            config,
            groups,
            eventCategories,
            createMatchEvent({
                gameId: "wardogs",
                side: "Valkyra",
                matchTeams: [
                    createMatchTeam("c", "Charlie", { shortCode: "CH" }),
                    createMatchTeam("a", "Alpha", {
                        shortCode: "ALP",
                        side: "Valkyra",
                    }),
                    createMatchTeam("b", "Bravo", { side: "Manticore" }),
                ],
            }),
            undefined,
            {},
            {
                factionEmoji: {
                    valkyra: "<:logi_valkyra_1:111111111111111111>",
                },
            }
        ).toJSON().description ?? ""

    assert.equal(
        description.split("\n")[0],
        "<:logi_valkyra_1:111111111111111111> **ALP** Valkyra  vs  ◈ **Bravo** Manticore  vs  **CH**"
    )
    assert.doesNotMatch(description, /Strana|🛡️/)
})

test("sides use the clan language and events without teams show the clan side", () => {
    const event = createMatchEvent({
        matchTeams: [
            createMatchTeam("a", "Alpha", { side: "Allies" }),
            createMatchTeam("b", "Bravo", { side: "Axis" }),
        ],
    })
    const firstLine = (language: "en" | "cs" | "de", value = event) =>
        (
            buildEventEmbed(
                { ...config, defaultLanguage: language },
                groups,
                eventCategories,
                value
            ).toJSON().description ?? ""
        ).split("\n")[0]

    assert.equal(firstLine("cs"), "★ **Alpha** Spojenci  vs  ✚ **Bravo** Osa")
    assert.equal(
        firstLine("de"),
        "★ **Alpha** Alliierte  vs  ✚ **Bravo** Achsenmächte"
    )
    assert.equal(
        firstLine("cs", createMatchEvent({ side: "Axis", matchTeams: [] })),
        "**Strana:** ✚ Osa"
    )
    assert.equal(
        firstLine("en", createMatchEvent({ side: "Blue team" })),
        "**Side:** Blue team"
    )
    assert.doesNotMatch(
        buildEventEmbed(
            config,
            groups,
            eventCategories,
            createTrainingEvent({
                matchTeams: [createMatchTeam("a", "Alpha")],
            })
        ).toJSON().description ?? "",
        /Alpha/
    )
})

test("match team labels escape Markdown, neutralize mentions and never form links", () => {
    const description =
        buildEventEmbed(
            { ...config, defaultLanguage: "en" },
            groups,
            eventCategories,
            createMatchEvent({
                matchTeams: [
                    createMatchTeam(
                        "a",
                        "<@123> *Bold* __u__ @everyone [x](https://evil.example)",
                        { side: "Allies" }
                    ),
                    createMatchTeam("b", "Line\nbreak <:emoji:1> <@&5>", {
                        shortCode: "x](https://evil.example)",
                    }),
                ],
            })
        ).toJSON().description ?? ""
    const teamsLine = description.split("\n")[0] ?? ""

    assert.match(teamsLine, / {2}vs {2}/)
    assert.doesNotMatch(teamsLine, /<@|<#|<:|@everyone|https:\/\//)
    assert.doesNotMatch(teamsLine, /assets\.example\.test/)
    assert.match(teamsLine, /@\u200Beveryone/)
    assert.match(teamsLine, /<\u200B@\u200B123>/)
    assert.match(teamsLine, /\\\*Bold\\\* \\_\\_u\\_\\_/)
    assert.match(
        teamsLine,
        /\\\[x\\\]\\\(https:\u200B\/\/evil\.example\\\)\*\* Allies/
    )
    assert.match(
        teamsLine,
        /\*\*x\\\]\\\(https:\u200B\/\/evil\.example\\\)\*\*$/
    )
})

test("escapeMatchTeamText neutralizes block Markdown at the start of a line", () => {
    assert.equal(escapeMatchTeamText("> quote"), "\\> quote")
    assert.equal(escapeMatchTeamText("# Heading"), "\\# Heading")
    assert.equal(escapeMatchTeamText("- item"), "\\- item")
    assert.equal(escapeMatchTeamText("- # item"), "\\- \\# item")
    assert.equal(escapeMatchTeamText("Alpha-Bravo"), "Alpha\\-Bravo")
    assert.equal(
        escapeMatchTeamText(`Alpha${"-".repeat(20)}Squad`),
        `Alpha${"\\-".repeat(20)}Squad`
    )
    assert.doesNotMatch(escapeMatchTeamText("-".repeat(120)), /--/)
    assert.equal(escapeMatchTeamText("1. first"), "1\\. first")
    assert.equal(escapeMatchTeamText("  Alpha\tSquad  "), "Alpha Squad")
    assert.equal(
        escapeMatchTeamText("<t:1:R> </cmd:1> <a:wave:2> <id:browse>"),
        "<\u200Bt:1:R> <\u200B/cmd:1> <\u200Ba:wave:2> <\u200Bid:browse>"
    )
})

test("buildMatchTeamLogoEmbeds renders one small card per team logo within game limits", () => {
    const hll = createMatchEvent({
        gameId: "hell_let_loose",
        matchTeams: [
            createMatchTeam("b", "Bravo", { side: "Axis" }),
            createMatchTeam("a", "Alpha @here", {
                shortCode: "A_1",
                side: "Allies",
            }),
            createMatchTeam("c", "Charlie"),
        ],
    })
    const embeds = buildMatchTeamLogoEmbeds(hll, 0xdc2626).map(toPlainJson)

    assert.deepEqual(embeds, [
        {
            author: {
                name: "Alpha @\u200Bhere [A_1]",
                icon_url: "https://assets.example.test/a.png",
            },
            color: 0xdc2626,
            description: "Allies",
        },
        {
            author: {
                name: "Bravo",
                icon_url: "https://assets.example.test/b.png",
            },
            color: 0xdc2626,
            description: "Axis",
        },
    ])

    const wardogs = createMatchEvent({
        gameId: "wardogs",
        matchTeams: [
            createMatchTeam("a", "Alpha"),
            createMatchTeam("b", "Bravo"),
            createMatchTeam("c", "Charlie", { side: "Lonestar" }),
        ],
    })
    const wardogsEmbeds = buildMatchTeamLogoEmbeds(wardogs, 0x123456).map(
        (embed) => embed.toJSON()
    )
    assert.deepEqual(
        wardogsEmbeds.map((embed) => embed.author?.name),
        ["Alpha", "Bravo", "Charlie"]
    )
    assert.equal(wardogsEmbeds[0]?.description, undefined)
    assert.equal(wardogsEmbeds[2]?.description, "Lonestar")
    assert.equal(buildMatchTeamLogoEmbeds(wardogs, 0x123456, 9).length, 1)
    assert.equal(buildMatchTeamLogoEmbeds(wardogs, 0x123456, 10).length, 0)
    assert.equal(
        buildMatchTeamLogoEmbeds(
            createTrainingEvent({ matchTeams: wardogs.matchTeams }),
            0x123456
        ).length,
        0
    )
})

test("buildMatchTeamLogoEmbeds skips teams without an http(s) logo", () => {
    const event = createMatchEvent({
        gameId: "wardogs",
        matchTeams: [
            createMatchTeam("a", "Alpha", { logoUrl: null }),
            createMatchTeam("b", "Bravo", {
                logoUrl: "javascript:alert(1)",
            }),
            createMatchTeam("c", "Charlie", { logoUrl: "not a url" }),
        ],
    })
    assert.deepEqual(buildMatchTeamLogoEmbeds(event, 0x123456), [])

    const http = buildMatchTeamLogoEmbeds(
        createMatchEvent({
            matchTeams: [
                createMatchTeam("a", "Alpha", {
                    logoUrl: "http://assets.example.test/a.png",
                }),
                createMatchTeam("b", "Bravo", {
                    logoUrl: "ftp://assets.example.test/b.png",
                }),
            ],
        }),
        undefined
    ).map(toPlainJson)
    assert.deepEqual(http, [
        {
            author: {
                name: "Alpha",
                icon_url: "http://assets.example.test/a.png",
            },
        },
    ])
})

test("Components V2 information cards add one logo section per team only when requested", () => {
    const payload = {
        config: { ...config, defaultLanguage: "en" },
        groups,
        guild: { eventCategories },
        rosters: [],
        userDisplayNames: {},
    } as unknown as SyncPayload
    const event = createMatchEvent({
        matchTeams: [
            createMatchTeam("b", "Bravo *B*", { side: "Axis" }),
            createMatchTeam("a", "Alpha", {
                shortCode: "ALP",
                side: "Allies",
                logoUrl: null,
            }),
        ],
    })

    const card = buildAnnouncementV2Message(
        payload,
        event,
        {},
        {
            matchTeamCards: true,
        }
    )
    const sections = v2Sections(card)
    assert.equal(sections.length, 1)
    assert.deepEqual(sections[0], {
        type: 9,
        components: [{ type: 10, content: "**Bravo \\*B\\***\nAxis" }],
        accessory: {
            type: 11,
            media: { url: "https://assets.example.test/b.png" },
            description: "Bravo *B*",
        },
    })
    const rendered = JSON.stringify(card.components?.[0]?.toJSON())
    assert.match(rendered, /★ \*\*ALP\*\* Allies {2}vs {2}✚ \*\*Bravo/)

    assert.deepEqual(
        v2Sections(buildAnnouncementV2Message(payload, event, {})),
        []
    )
    const legacyEvent = createMatchEvent()
    assert.deepEqual(
        toPlainJson(
            buildAnnouncementV2Message(
                payload,
                legacyEvent,
                {},
                {
                    matchTeamCards: true,
                }
            )
        ),
        toPlainJson(buildAnnouncementV2Message(payload, legacyEvent, {}))
    )
})

test("Components V2 cards keep hyphen-run team names on one literal sides line", () => {
    const payload = {
        config: { ...config, defaultLanguage: "en" },
        groups,
        guild: { eventCategories },
        rosters: [],
        userDisplayNames: {},
    } as unknown as SyncPayload
    const event = createMatchEvent({
        matchTeams: [
            createMatchTeam("a", `${"-".repeat(20)}# Pwned heading`, {
                side: "Allies",
            }),
            createMatchTeam("b", `Bravo${"-".repeat(20)}> quoted`, {
                side: "Axis",
            }),
        ],
    })
    const message = buildAnnouncementV2Message(payload, event, {})
    const container = message.components?.[0]?.toJSON()
    const contents = (
        container && "components" in container ? container.components : []
    ).flatMap((component) => {
        if (component.type === 10) return [component.content]
        if (component.type === 9)
            return component.components.map((text) => text.content)
        return []
    })
    const sidesLine = contents[0]?.split("\n")[1] ?? ""

    assert.match(sidesLine, /Pwned heading\*\* Allies {2}vs {2}✚ \*\*Bravo/)
    assert.match(sidesLine, /> quoted\*\* Axis$/)
    assert.doesNotMatch(sidesLine, /--/)
    for (const content of contents) {
        assert.doesNotMatch(content, /^(#{1,2} |>)/m)
    }
})

test("match team logo labels stay within Discord UTF-16 limits and never contain URLs", () => {
    const longName = `${"@".repeat(108)}${"😀".repeat(6)}`
    const longCode = "@".repeat(16)
    const loneSurrogate =
        /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
    const event = createMatchEvent({
        matchTeams: [
            createMatchTeam("a", longName, { shortCode: longCode }),
            createMatchTeam("b", "B".repeat(300)),
        ],
    })

    const embeds = buildMatchTeamLogoEmbeds(event, 0x123456).map((embed) =>
        embed.toJSON()
    )
    assert.equal(embeds.length, 2)
    for (const embed of embeds) {
        const name = embed.author?.name ?? ""
        assert.ok(name.length > 0 && name.length <= 256)
        assert.doesNotMatch(name, loneSurrogate)
    }
    assert.equal(embeds[1]?.author?.name, "B".repeat(256))
    assert.ok(
        buildMatchTeamV2Sections(event).every((section) => {
            const accessory = section.toJSON().accessory
            return (
                accessory.type === 11 &&
                (accessory.description ?? "").length <= 1024
            )
        })
    )

    const linked = createMatchEvent({
        matchTeams: [
            createMatchTeam("a", "Visit https://evil.example/join", {
                shortCode: "x://y",
            }),
        ],
    })
    const [linkedEmbed] = buildMatchTeamLogoEmbeds(linked, 0x123456).map(
        (embed) => embed.toJSON()
    )
    assert.equal(
        linkedEmbed?.author?.name,
        "Visit https:\u200B//evil.example/join [x:\u200B//y]"
    )
    const [linkedSection] = buildMatchTeamV2Sections(linked).map((section) =>
        section.toJSON()
    )
    assert.ok(linkedSection?.accessory.type === 11)
    assert.doesNotMatch(
        linkedSection.accessory.type === 11
            ? (linkedSection.accessory.description ?? "")
            : "",
        /:\/\//
    )
})

test("roster members without a stored name appear as a mention, never as a raw ID", () => {
    const event = createMatchEvent()
    const summary = buildRosterSummaryText(config, event, {
        id: "roster-1",
        eventId: event.id,
        published: true,
        reservePlayerIds: [],
        updatedAt: "2026-07-29T10:00:00.000Z",
        squads: [
            {
                name: "Command",
                group: "Command",
                color: "#d4a017",
                order: 1,
                players: [{ id: "123456789012345678", ack: false }],
            },
        ],
    })

    assert.match(summary, /<@123456789012345678>/)
    assert.doesNotMatch(summary, /(^|[^@])123456789012345678/)
})

test("published roster cards list meeting, squads with counts and reserves", () => {
    const event = createMatchEvent({
        meetingChannelId: "meeting-1",
        matchType: "competitive",
    })
    const roster: Roster = {
        id: "roster-1",
        eventId: event.id,
        published: true,
        reservePlayerIds: ["reserve-1", "reserve-2"],
        updatedAt: "2026-07-29T10:00:00.000Z",
        squads: [
            {
                name: "Able",
                group: "Infantry",
                color: "#16a34a",
                order: 2,
                players: [
                    { id: "a1", ack: false },
                    { id: "a2", ack: false },
                    { customName: "Guest", ack: false },
                    { ack: false },
                ],
            },
            {
                name: "Command",
                group: "Command",
                color: "#d4a017",
                order: 1,
                players: [{ id: "commander", ack: false }],
            },
            {
                name: "Empty",
                group: "Recon",
                color: "#000000",
                order: 3,
                players: [{ ack: false }],
            },
        ],
    }
    const summary = buildRosterSummaryText(config, event, roster, {
        commander: "Hráč 01",
    })

    assert.equal(
        summary,
        [
            "Sraz <t:1785330000:t> (<t:1785330000:R>) v kanálu <#meeting-1>",
            "**Command** · Hráč 01",
            "**Able** · 3 hráči",
            "**Zálohy** · 2 hráči",
        ].join("\n")
    )

    const payload = {
        config,
        groups,
        guild: { eventCategories },
        rosters: [roster],
        userDisplayNames: {},
    } as unknown as SyncPayload
    const card = JSON.stringify(
        buildAnnouncementV2Message(
            payload,
            event,
            { commander: "Hráč 01" },
            { showPublishedRosterImage: true }
        ).components?.[0]?.toJSON()
    )
    assert.match(card, /### Soupiska · Test Match\\n/)
    assert.match(card, /\*\*Able\*\* · 3 hráči/)
    assert.match(card, /roster-assignment:event-1/)
    assert.match(card, /Celá soupiska na webu/)
    // The roster card is only the roster: no facts, sign-ups or calendar.
    assert.doesNotMatch(card, /Přihlášeno|Do kalendáře|Competitive/)
})

test("reminder DMs offer confirm, running late and can't make it", () => {
    const buttons = buildAttendanceReminderComponents("event-1", "cs")
        .flatMap((row) => row.toJSON().components)
        .map((button) => ({
            label: "label" in button ? button.label : undefined,
            style: button.style,
            customId: "custom_id" in button ? button.custom_id : undefined,
        }))
    assert.deepEqual(buttons, [
        { label: "Potvrdím", style: 3, customId: "attendance:event-1:ack" },
        {
            label: "Přijdu později",
            style: 2,
            customId: "attendance-late:event-1",
        },
        {
            label: "Nemůžu",
            style: 4,
            customId: "attendance-decline:event-1",
        },
    ])
})

test("the announcement ping sits above the card", () => {
    const payload = {
        config,
        groups,
        guild: { eventCategories },
        rosters: [],
        userDisplayNames: {},
    } as unknown as SyncPayload
    const [lead, card] =
        buildAnnouncementV2Message(
            payload,
            createMatchEvent(),
            {},
            {
                pingRoleIds: ["role-1"],
            }
        ).components ?? []
    assert.deepEqual(lead?.toJSON(), { type: 10, content: "<@&role-1>" })
    assert.equal(card?.toJSON().type, 17)
    assert.doesNotMatch(JSON.stringify(card?.toJSON()), /<@&role-1>/)
})
