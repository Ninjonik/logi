import assert from "node:assert/strict"
import test from "node:test"

import {
    buildCalendarPanelEmbed,
    buildMembershipPanelComponents,
    buildMembershipPanelMessage,
    membershipCategoryLines,
} from "./message-builders"
import type {
    CalendarItem,
    DiscordConfig,
    EventCategory,
    EventRecord,
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
