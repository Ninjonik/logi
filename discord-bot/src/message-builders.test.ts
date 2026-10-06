import assert from "node:assert/strict"
import test from "node:test"

import {
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
