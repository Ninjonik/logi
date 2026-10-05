import assert from "node:assert/strict"
import test from "node:test"

import {
    buildAnnouncementV2Message,
    buildCalendarPanelEmbed,
    buildCompactV2FieldText,
    buildEventComponents,
    buildEventEmbed,
    buildMatchTeamLogoEmbeds,
    buildMatchTeamV2Sections,
    buildMembershipPanelComponents,
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

test("buildCompactV2FieldText removes padding and preserves row order when compacting columns", () => {
    const result = buildCompactV2FieldText([
        { name: "Infantry (4)", value: "Alpha\nDelta", inline: true },
        { name: "\u200B", value: "Bravo", inline: true },
        { name: "\u200B", value: "Charlie", inline: true },
        { name: "\u200B", value: "\u200B", inline: true },
        { name: "Armor (0)", value: "Nobody yet", inline: true },
    ])

    assert.equal(
        result,
        "**Infantry (4)**\nAlpha, Bravo, Charlie, Delta\n\n**Armor (0)**\nNobody yet"
    )
})

test("membership panel categories open the shared membership wizard", () => {
    const membershipConfig: DiscordConfig = {
        ...config,
        membershipSettings: {
            enabled: true,
            submitChannelId: "submit",
            applicationParentChannelId: "parent",
            panelTitle: "Apply",
            panelDescription: "Choose a category.",
            autoAssignRecruitOnApply: false,
            categories: [
                {
                    id: "recruit",
                    supportRoleIds: [],
                    recruitRoleIds: [],
                    finalRoleIds: [],
                    modalQuestions: [],
                    assignmentType: "member",
                    gameId: "wardogs",
                },
            ],
        },
    }

    const applyButton =
        buildMembershipPanelComponents(membershipConfig)[0]?.toJSON()
            .components[0]

    assert.equal(
        applyButton && "custom_id" in applyButton
            ? applyButton.custom_id
            : undefined,
        "membership:apply"
    )
})

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
        ["Přihlásit se", "Moje přihláška", "Nepřijdu", "Přidat do kalendáře"]
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

test("buildEventEmbed omits group fields when signupGroupIds is empty", () => {
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
            ],
        })
    )

    const fields = embed.toJSON().fields ?? []
    assert.equal(fields.length, 1)
    assert.match(fields[0]?.name ?? "", /Neúčastní se|Not attending/i)
})

test("buildEventEmbed uses training-specific start wording for trainings", () => {
    const embed = buildEventEmbed(
        config,
        groups,
        eventCategories,
        createTrainingEvent()
    )

    assert.match(
        embed.toJSON().description ?? "",
        /Začátek trainingu|Training Start/
    )
    assert.doesNotMatch(
        embed.toJSON().description ?? "",
        /Start zápasu|Match Start/
    )
})

test("buildEventEmbed shows the match start, meeting and sign-up deadline as short Discord times", () => {
    const embed = buildEventEmbed(
        { ...config, defaultLanguage: "en" },
        groups,
        eventCategories,
        createMatchEvent({ map: "Foy", cap: "50", matchType: "competitive" })
    ).toJSON()
    const [header] = (embed.description ?? "").split(/\n-{20,}\n/)

    assert.equal(embed.title, "Test Match · Competitive")
    assert.equal(embed.color, 0xdc2626)
    assert.equal(
        header,
        [
            "**Match Start:** <t:1785333600:F>",
            "Foy · Cap 50 · meeting <t:1785330000:t> · sign-ups close <t:1785328200:R>",
        ].join("\n")
    )
    // Decorative line icons are gone; times stay Discord timestamps.
    assert.doesNotMatch(embed.description ?? "", /🗺️|🎮|🔒|📌|👥|🏷️/)
    // Once registration closes the status says so; no past deadline.
    assert.doesNotMatch(
        buildEventEmbed(
            { ...config, defaultLanguage: "en" },
            groups,
            eventCategories,
            createMatchEvent({ status: "closed" })
        ).toJSON().description ?? "",
        /sign-ups close/
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
    assert.match(header ?? "", /^\*\*⚔️ Side:\*\* Allies$/m)
    assert.match(header ?? "", /^\*\*🕒 Match Start:\*\* <t:\d+:F>$/m)
    assert.match(header ?? "", /^🗺️ Foy · /m)
    assert.match(
        plain.description ?? "",
        /^📋 \*\*Signed up 0\*\* · Status: Registration$/m
    )

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
        0xffb000
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

test("buildEventEmbed shows the total number of signed-up players", () => {
    const event = createMatchEvent({
        participants: [
            {
                userId: "one",
                status: "attending",
                updatedAt: "2026-07-29T10:00:00.000Z",
            },
            {
                userId: "two",
                status: "not_attending",
                updatedAt: "2026-07-29T10:00:00.000Z",
            },
        ],
    })
    const description = buildEventEmbed(
        { ...config, defaultLanguage: "en" },
        groups,
        eventCategories,
        event
    ).toJSON().description

    assert.match(
        description ?? "",
        /\*\*Signed up 1\*\* · Status: Registration/
    )
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

    assert.match(description ?? "", /Event forum: <#forum-123>/)
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

test("buildEventEmbed uses plain display names instead of Discord mentions", () => {
    const embed = buildEventEmbed(
        config,
        groups,
        eventCategories,
        createMatchEvent({
            participants: [
                {
                    userId: "user-1",
                    status: "attending",
                    updatedAt: "2026-07-29T10:00:00.000Z",
                },
                {
                    userId: "user-2",
                    status: "not_attending",
                    updatedAt: "2026-07-29T10:00:00.000Z",
                },
            ],
        }),
        undefined,
        {
            "user-1": "Alpha Nick",
            "user-2": "Bravo Nick",
        }
    )

    const fields = embed.toJSON().fields ?? []
    const combinedValues = fields.map((field) => field.value ?? "").join(" | ")
    assert.match(combinedValues, /Alpha Nick/)
    assert.match(combinedValues, /Bravo Nick/)
    assert.doesNotMatch(combinedValues, /<@/)
})

for (const language of ["en", "cs", "de"] as const) {
    test(`buildEventEmbed alphabetizes signup columns using the configured ${language} locale`, () => {
        const embed = buildEventEmbed(
            { ...config, defaultLanguage: language },
            groups,
            eventCategories,
            createMatchEvent({
                participants: [
                    {
                        userId: "user-1",
                        status: "attending",
                        group: "command",
                        updatedAt: "2026-07-29T10:00:00.000Z",
                    },
                    {
                        userId: "user-2",
                        status: "attending",
                        group: "command",
                        updatedAt: "2026-07-29T10:00:00.000Z",
                    },
                    {
                        userId: "user-3",
                        status: "attending",
                        group: "command",
                        updatedAt: "2026-07-29T10:00:00.000Z",
                    },
                    {
                        userId: "user-4",
                        status: "attending",
                        group: "command",
                        updatedAt: "2026-07-29T10:00:00.000Z",
                    },
                    {
                        userId: "user-5",
                        status: "attending",
                        group: "command",
                        updatedAt: "2026-07-29T10:00:00.000Z",
                    },
                    {
                        userId: "user-6",
                        status: "attending",
                        group: "command",
                        updatedAt: "2026-07-29T10:00:00.000Z",
                    },
                    {
                        userId: "user-7",
                        status: "attending",
                        group: "command",
                        updatedAt: "2026-07-29T10:00:00.000Z",
                    },
                ],
            }),
            undefined,
            {
                "user-1": "Golf",
                "user-2": "Delta",
                "user-3": "Alpha",
                "user-4": "Foxtrot",
                "user-5": "Charlie",
                "user-6": "Echo",
                "user-7": "Bravo",
            }
        )

        const fields = embed.toJSON().fields ?? []
        assert.equal(fields[0]?.inline, true)
        assert.equal(fields[1]?.inline, true)
        assert.equal(fields[2]?.inline, true)
        assert.match(fields[0]?.name ?? "", /Command \(7\)/)
        const expected =
            language === "cs"
                ? ["Alpha\nEcho\nCharlie", "Bravo\nFoxtrot", "Delta\nGolf"]
                : ["Alpha\nDelta\nGolf", "Bravo\nEcho", "Charlie\nFoxtrot"]
        assert.deepEqual(
            fields.slice(0, 3).map((field) => field.value),
            expected
        )
        assert.equal(
            buildCompactV2FieldText(fields.slice(0, 3)),
            `**${fields[0]!.name}**\n${
                language === "cs"
                    ? "Alpha, Bravo, Delta, Echo, Foxtrot, Golf, Charlie"
                    : "Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf"
            }`
        )
    })
}

test("buildEventEmbed pads signup sections so the next group starts on a new row", () => {
    const embed = buildEventEmbed(
        config,
        groups,
        eventCategories,
        createMatchEvent({
            participants: [
                {
                    userId: "user-1",
                    status: "attending",
                    group: "command",
                    updatedAt: "2026-07-29T10:00:00.000Z",
                },
                {
                    userId: "user-2",
                    status: "attending",
                    group: "inf",
                    updatedAt: "2026-07-29T10:00:00.000Z",
                },
            ],
        })
    )

    const fields = embed.toJSON().fields ?? []
    assert.equal(
        fields.some(
            (field) => field.name === "\u200B" && field.value === "\u200B"
        ),
        true
    )
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

test("published roster keeps signup groups visible while registration is open", () => {
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
        {
            "user-1": "Alpha",
        },
        { showPublishedRosterImage: true }
    ).toJSON()

    assert.ok(embed.image?.url)
    assert.equal(
        embed.fields?.some((field) => /Command \(1\)/.test(field.name)),
        true
    )
    assert.equal(
        embed.fields?.some((field) => field.value === "Alpha"),
        true
    )
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

test("buildEventEmbed lists match teams by slot next to the side line", () => {
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
            })
        ).toJSON().description ?? ""
    const lines = description.split("\n")
    const sideIndex = lines.findIndex((line) => line === "**Strana:** Valkyra")

    assert.ok(sideIndex >= 0)
    assert.equal(
        lines[sideIndex + 1],
        "**🛡️ Týmy:** Alpha [ALP] (Valkyra) vs Bravo (Manticore) vs Charlie [CH]"
    )
})

test("buildEventEmbed uses localized team wording and omits empty assignments", () => {
    const event = createMatchEvent({
        matchTeams: [
            createMatchTeam("a", "Alpha", { side: "Allies" }),
            createMatchTeam("b", "Bravo", { side: "Axis" }),
        ],
    })
    const english = buildEventEmbed(
        { ...config, defaultLanguage: "en" },
        groups,
        eventCategories,
        event
    ).toJSON().description
    const german = buildEventEmbed(
        { ...config, defaultLanguage: "de" },
        groups,
        eventCategories,
        event
    ).toJSON().description

    assert.match(
        english ?? "",
        /\*\*🛡️ Teams:\*\* Alpha \(Allies\) vs Bravo \(Axis\)/
    )
    assert.match(german ?? "", /\*\*🛡️ Teams:\*\* Alpha \(Allies\) vs Bravo/)

    const legacy = buildEventEmbed(
        config,
        groups,
        eventCategories,
        createMatchEvent()
    ).toJSON()
    assert.deepEqual(
        buildEventEmbed(
            config,
            groups,
            eventCategories,
            createMatchEvent({ matchTeams: [] })
        ).toJSON(),
        legacy
    )
    assert.doesNotMatch(legacy.description ?? "", /🛡️/)
    assert.doesNotMatch(
        buildEventEmbed(
            config,
            groups,
            eventCategories,
            createTrainingEvent({
                matchTeams: [createMatchTeam("a", "Alpha")],
            })
        ).toJSON().description ?? "",
        /🛡️/
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
                        { shortCode: "<#9>", side: "Allies" }
                    ),
                    createMatchTeam("b", "Line\nbreak <:emoji:1> <@&5>", {
                        shortCode: "x](https://evil.example)",
                    }),
                ],
            })
        ).toJSON().description ?? ""
    const teamsLine =
        description.split("\n").find((line) => line.includes("🛡️")) ?? ""

    assert.ok(teamsLine)
    assert.doesNotMatch(teamsLine, /<@|<#|<:|@everyone|https:\/\//)
    assert.doesNotMatch(teamsLine, /assets\.example\.test/)
    assert.match(teamsLine, /@\u200Beveryone/)
    assert.match(teamsLine, /<\u200B@\u200B123>/)
    assert.match(teamsLine, /\\\*Bold\\\* \\_\\_u\\_\\_/)
    assert.match(teamsLine, /\\\[x\\\]\\\(https:\u200B\/\/evil\.example\\\)/)
    assert.match(teamsLine, /\[<\u200B#9>\] \(Allies\)/)
    assert.match(teamsLine, /Line break <\u200B:emoji:1> <\u200B@\u200B&5>/)
    assert.match(teamsLine, /\[x\\\]\\\(https:\u200B\/\/evil\.example\\\)\]$/)
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
    assert.match(rendered, /🛡️ Teams:\*\* Alpha \[ALP\] \(Allies\) vs Bravo/)

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

test("Components V2 cards keep hyphen-run team names in one literal Teams line", () => {
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
    const teamsBlocks = contents.filter((content) => content.includes("🛡️"))

    assert.equal(teamsBlocks.length, 1)
    const teamsLine =
        teamsBlocks[0]?.split("\n").find((line) => line.includes("🛡️")) ?? ""
    assert.match(teamsLine, /Pwned heading \(Allies\) vs Bravo/)
    assert.match(teamsLine, /> quoted \(Axis\)$/)
    assert.doesNotMatch(teamsLine, /--/)
    for (const content of contents.slice(1)) {
        assert.doesNotMatch(content, /^(#|>)/m)
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

test("members without a stored name appear as a mention, never as a raw ID", () => {
    const fields =
        buildEventEmbed(
            config,
            groups,
            eventCategories,
            createMatchEvent({
                participants: [
                    {
                        userId: "123456789012345678",
                        status: "attending",
                        updatedAt: "2026-07-29T10:00:00.000Z",
                    },
                ],
            })
        ).toJSON().fields ?? []
    const values = fields.map((field) => field.value).join("\n")

    assert.match(values, /<@123456789012345678>/)
    assert.doesNotMatch(values, /(^|[^@])123456789012345678/)
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
    assert.match(card, /# Soupiska · Test Match · Competitive/)
    assert.match(card, /\*\*Able\*\* · 3 hráči/)
    assert.match(card, /roster-assignment:event-1/)
    assert.match(card, /Celá soupiska na webu/)
})
