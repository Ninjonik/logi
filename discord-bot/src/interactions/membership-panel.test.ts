import assert from "node:assert/strict"
import test, { after } from "node:test"

import {
    SETTINGS_PREVIEW_NOW,
    settingsPreview,
} from "../../../src/domain/discord-messages/settings-previews"
import {
    applicationPanelDefaults,
    getApplicationMessages,
} from "../../../src/lib/clan-language/application"
import {
    buildMembershipPanelPayload,
    panelWindowCount,
} from "./membership-panel"
import { layoutMessageView } from "../../../src/domain/discord-messages/message-layout"
import { getAnnouncementMessages } from "../../../src/lib/clan-language/announcements"
import { getDirectMessages } from "../../../src/lib/clan-language/direct-messages"
import { getTicketMessages } from "../../../src/lib/clan-language/tickets"
import { getRosterMessages } from "../../../src/lib/clan-language/rosters"
import { getSystemMessages } from "../../../src/lib/clan-language/system"
import { getPanelMessages } from "../../../src/lib/clan-language/panels"
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
    const payload = buildMembershipPanelPayload(value, "Vlci")
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
        buildMembershipPanelPayload(
            {
                ...config,
                membershipSettings: {
                    ...config.membershipSettings!,
                    categories: [],
                },
            },
            "Vlci"
        ),
        null
    )
})

test("a never-changed default reads the board copy in the clan language (L6-12, N4-07/08)", () => {
    // The pre-redesign default the dashboard seeded, even in another language.
    for (const legacy of [
        {
            panelTitle: "Přihlásit se do klanu",
            panelDescription:
                "Vyberte typ přihlášky, který vám odpovídá. Pokud ještě potřebujeme vaše platform ID, nejdřív vás tím provedeme.",
        },
        {
            panelTitle: "Apply to the clan",
            panelDescription:
                "Pick the application type that matches you. If we still need your platform ID, we will guide you through it first.",
        },
        // The English default seeded before a switch to Czech.
        {
            panelTitle: "Join the Vlci clan",
            panelDescription:
                "Choose how you want to play with us. The application has three short windows and takes a few minutes.",
        },
    ]) {
        const { text } = render({
            ...config,
            membershipSettings: { ...config.membershipSettings!, ...legacy },
        })
        assert.match(text, /### Přidej se ke klanu Vlci/)
        assert.match(
            text,
            /Vyber, jak s námi chceš hrát\. Přihláška má tři krátká okna a zabere pár minut\./
        )
        // The default text already says it: no second windows note.
        assert.doesNotMatch(text, /zabere asi 3 minuty/)
        assert.doesNotMatch(text, /platform ID|Vyberte/)
    }
    // Custom text stays as written, with the note.
    const custom = render(config).text
    assert.match(custom, /Hrajeme Hell Let Loose a Wardogs/)
    assert.match(custom, /zabere asi 3 minuty/)
})

test("the 'Zprávy a panely' preview draws the panel words the bot posts (N1-B07, res. 23)", () => {
    const system = getSystemMessages("cs")
    for (const stored of [
        {
            panelTitle: "Přihlásit se do klanu",
            panelDescription:
                "Vyberte typ přihlášky, který vám odpovídá. Pokud ještě potřebujeme vaše platform ID, nejdřív vás tím provedeme.",
        },
        {
            panelTitle: "Nábor Vlků",
            panelDescription: "Hledáme hráče na zápasy.",
        },
    ]) {
        const settings = { ...config.membershipSettings!, ...stored }
        const bot = render({ ...config, membershipSettings: settings }).text
        const preview = settingsPreview({
            kind: "recruitmentPanel",
            samples: system.previews,
            dm: getDirectMessages("cs"),
            roster: getRosterMessages("cs"),
            errors: system.errorsChannel,
            teamRequests: system.teamRequests,
            announcement: getAnnouncementMessages("cs"),
            applications: getApplicationMessages("cs"),
            applicationPanelDefaults,
            tickets: getTicketMessages("cs"),
            reports: getPanelMessages("cs").report,
            clan: {
                membership: {
                    title: settings.panelTitle,
                    text: settings.panelDescription,
                    clanName: "Vlci",
                    categories: settings.categories,
                    form: settings.applicationForm,
                },
            },
            layout: { copy: system.kit, locale: system.locale },
            timeZone: "Europe/Prague",
            now: SETTINGS_PREVIEW_NOW,
            rosterVariant: "photo_text",
            siteUrl: "https://logi.example",
        })
        const shown = layoutMessageView(preview.view, {
            copy: system.kit,
            locale: system.locale,
        })
            .nodes.flatMap((node) =>
                node.type === "text" ? [node.content] : []
            )
            .join("\n")
        // Everything but the "Spravováno v Logi" link is the same.
        const words = (value: string) =>
            value.split("\n").filter((line) => !line.includes("Logi"))
        assert.deepEqual(words(shown), words(bot))
    }
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
