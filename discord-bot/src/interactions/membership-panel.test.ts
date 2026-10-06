import assert from "node:assert/strict"
import test, { after } from "node:test"

import {
    buildMembershipPanelPayload,
    panelWindowCount,
} from "./membership-panel"
import { closeConvexClient } from "../convex"
import type { DiscordConfig } from "../types"

after(closeConvexClient)

const category = {
    supportRoleIds: [],
    recruitRoleIds: [],
    finalRoleIds: [],
    modalQuestions: [],
}

const config: DiscordConfig = {
    id: "config-1",
    guildId: "123456789012345678",
    timezone: "Europe/Prague",
    defaultLanguage: "cs",
    calendarCategories: [],
    updatedAt: "2026-10-05T10:00:00.000Z",
    membershipSettings: {
        enabled: true,
        submitChannelId: "1",
        applicationParentChannelId: "2",
        panelTitle: "Přidej se ke klanu Vlci",
        panelDescription:
            "Hrajeme Hell Let Loose a Wardogs, zápasy každý týden a ligu.",
        panelImageUrl: "https://example.com/banner.webp",
        autoAssignRecruitOnApply: false,
        categories: [
            {
                ...category,
                id: "main",
                gameId: "hell_let_loose",
                label: "Člen",
                description: "zápasy každý týden",
                assignmentType: "member",
            },
            {
                ...category,
                id: "merc",
                gameId: "wardogs",
                label: "Žoldák",
                description: "výpomoc na jednotlivé zápasy",
                assignmentType: "mercenary",
            },
        ],
    },
}

type Json = { type: number; [key: string]: unknown }

function flatten(component: Json): Json[] {
    const children = [
        ...((component.components as Json[] | undefined) ?? []),
        ...(component.accessory ? [component.accessory as Json] : []),
    ]
    return [component, ...children.flatMap(flatten)]
}

function render(value: DiscordConfig) {
    const payload = buildMembershipPanelPayload(value)
    assert.ok(payload)
    const container = JSON.parse(
        JSON.stringify(payload.components[0]!.toJSON())
    ) as Json
    const all = flatten(container)
    return {
        payload,
        container,
        text: all
            .filter((item) => item.type === 10)
            .map((item) => item.content)
            .join("\n"),
        buttons: all.filter((item) => item.type === 2),
    }
}

test("the panel is a V2 card in the clan colour with one blurple button (L6-12..14)", () => {
    const { container, text, buttons, payload } = render(config)
    assert.equal(container.accent_color, 0xe8a33d)
    assert.match(text, /### Přidej se ke klanu Vlci/)
    assert.match(text, /\*\*Člen\*\* · Hell Let Loose · zápasy každý týden/)
    assert.match(
        text,
        /\*\*Žoldák\*\* · Wardogs · výpomoc na jednotlivé zápasy/
    )
    assert.match(text, /Přihláška má tři krátká okna a zabere asi 3 minuty\./)
    assert.match(text, /Spravováno v Logi/)
    assert.deepEqual(
        buttons.map((button) => [button.label, button.style, button.custom_id]),
        [["Podat přihlášku", 1, "membership:apply"]]
    )
    // Nobody is pinged by the panel.
    assert.deepEqual(payload.allowedMentions, { parse: [] })
})

test("the web form adds a grey link button only when switched on (L6-15, N4-42)", () => {
    const { buttons } = render({
        ...config,
        membershipSettings: {
            ...config.membershipSettings!,
            webFormEnabled: true,
        },
    })
    assert.deepEqual(
        buttons.map((button) => [button.label, button.style]),
        [
            ["Podat přihlášku", 1],
            ["Vyplnit přihlášku na webu", 5],
        ]
    )
    assert.match(String(buttons[1]!.url), /\/cs\/apply\/123456789012345678$/)
})

test("the window note follows the form: two windows without clan questions", () => {
    assert.equal(panelWindowCount(config), 3)
    assert.equal(
        panelWindowCount({
            ...config,
            membershipSettings: {
                ...config.membershipSettings!,
                applicationForm: {
                    about: [],
                    accounts: [],
                    questionWindows: [],
                },
            },
        }),
        2
    )
})

test("a panel without categories is not posted", () => {
    assert.equal(
        buildMembershipPanelPayload({
            ...config,
            membershipSettings: {
                ...config.membershipSettings!,
                categories: [],
            },
        }),
        null
    )
})

test("a panel colour replaces the clan colour on the bar (L4-10)", () => {
    const { container } = render({
        ...config,
        membershipSettings: {
            ...config.membershipSettings!,
            panelAccentColor: "#3B82F6",
        },
    })
    assert.equal(container.accent_color, 0x3b82f6)
})
