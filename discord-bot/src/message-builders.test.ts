import assert from "node:assert/strict"
import test from "node:test"

import {
    buildAttendanceReminderComponents,
    buildCalendarPanelEmbed,
    buildMembershipPanelComponents,
    buildMembershipPanelMessage,
    membershipCategoryLines,
    buildRosterInfoEmbed,
    buildRosterInfoV2Message,
    buildRosterSummaryText,
} from "./message-builders"
import type {
    CalendarItem,
    DiscordConfig,
    EventCategory,
    EventRecord,
    Roster,
} from "./types"

const config: DiscordConfig = {
    id: "config-1",
    guildId: "guild-1",
    timezone: "Europe/Berlin",
    defaultLanguage: "cs",
    calendarCategories: [],
    updatedAt: "2026-07-29T10:00:00.000Z",
}

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

function futureIso(days: number, hours = 0) {
    return new Date(
        Date.now() + days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000
    ).toISOString()
}

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

test("the membership panel lists each category with its description", () => {
    const category = {
        supportRoleIds: [],
        recruitRoleIds: [],
        finalRoleIds: [],
        modalQuestions: [],
        assignmentType: "member" as const,
    }
    const membershipConfig: DiscordConfig = {
        ...config,
        membershipSettings: {
            enabled: true,
            panelTitle: "Přidej se",
            panelDescription: "Vyber, jak chceš hrát.",
            autoAssignRecruitOnApply: false,
            categories: [
                {
                    ...category,
                    id: "main",
                    emoji: "⭐",
                    label: "Hlavní člen",
                    description: "Pro hráče, kteří chtějí hrát každý týden.",
                },
                { ...category, id: "reserve", label: "Záloha" },
                { ...category, id: "merc", description: "  " },
            ],
        },
    }

    assert.equal(
        membershipCategoryLines(
            membershipConfig.membershipSettings!.categories
        ),
        "⭐ **Hlavní člen** · Pro hráče, kteří chtějí hrát každý týden.\n**Záloha**\n**merc**"
    )
    const message = buildMembershipPanelMessage(membershipConfig)
    const text = JSON.stringify(message?.components[0]?.toJSON())
    assert.ok(text.includes("# Přidej se"))
    assert.ok(text.includes("Vyber, jak chceš hrát."))
    assert.ok(text.includes("· Pro hráče, kteří chtějí hrát každý týden."))
    assert.ok(text.includes("membership:apply"))
})

test("a membership panel without categories is not posted", () => {
    assert.equal(
        buildMembershipPanelMessage({
            ...config,
            membershipSettings: {
                enabled: true,
                panelTitle: "Apply",
                panelDescription: "",
                autoAssignRecruitOnApply: false,
                categories: [],
            },
        }),
        null
    )
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
    const imageUrl = buildRosterInfoEmbed(config, event, roster).toJSON().image
        ?.url
    const signupOnlyUrl = buildRosterInfoEmbed(
        config,
        {
            ...event,
            updatedAt: "2026-07-29T10:01:00.000Z",
            signUps: [{ userId: "user-1" }],
        },
        roster
    ).toJSON().image?.url
    const rosterChangedUrl = buildRosterInfoEmbed(config, event, {
        ...roster,
        updatedAt: "2026-07-29T10:02:00.000Z",
    }).toJSON().image?.url

    assert.equal(signupOnlyUrl, imageUrl)
    assert.notEqual(rosterChangedUrl, imageUrl)
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

    const card = JSON.stringify(
        buildRosterInfoV2Message({ config }, event, roster, {
            commander: "Hráč 01",
        }).components[0]?.toJSON()
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

test("the roster card in the information channel keeps its image and buttons", () => {
    const roster: Roster = {
        id: "roster-1",
        eventId: "event-1",
        published: true,
        reservePlayerIds: [],
        updatedAt: "2026-07-29T10:00:00.000Z",
        squads: [],
    }
    const message = buildRosterInfoV2Message(
        { config },
        createMatchEvent({ status: "closed" }),
        roster,
        {},
        { rosterImageUrl: "attachment://roster.png" }
    )
    const json = JSON.stringify(
        message.components.map((component) => component.toJSON())
    )
    assert.match(json, /attachment:\/\/roster.png/)
    assert.match(json, /roster-assignment:event-1/)
})
