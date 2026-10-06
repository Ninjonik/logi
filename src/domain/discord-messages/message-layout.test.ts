import assert from "node:assert/strict"
import test from "node:test"

import {
    chipText,
    countLayoutComponents,
    footerText,
    headerLines,
    layoutMessageView,
    layoutTextLength,
    metaLineText,
    type MessageKitCopy,
    type MessageLayoutOptions,
} from "./message-layout"
import { panelFrame, unknownErrorCard, type MessageView } from "./message-view"

/** The frame words as the boards write them (the real copy is tested in clan-language). */
const csKit: MessageKitCopy = {
    updated: "Aktualizováno {time}",
    refreshEvery: "obnovuje se každých {seconds} s",
    managed: "Spravováno v Logi",
    dmClan: "Klan {clan}",
    dmSettings: "Nastavit zprávy",
    page: "Strana {page} z {pages}",
    paused: "Pozastaveno",
    lastData: "poslední data {time}",
}
const enKit: MessageKitCopy = {
    updated: "Updated {time}",
    refreshEvery: "refreshes every {seconds} s",
    managed: "Managed in Logi",
    dmClan: "Clan {clan}",
    dmSettings: "Message settings",
    page: "Page {page} of {pages}",
    paused: "Paused",
    lastData: "last data {time}",
}
const cs: MessageLayoutOptions = { copy: csKit, locale: "cs-CZ" }
const updatedAt = "2026-10-11T18:00:00Z"

test("a header subtitle sits between the title and the chips", () => {
    assert.deepEqual(
        headerLines(
            {
                label: "Chyba bota · Zápas",
                title: "Ohlášení zápasu se neodeslalo",
                subtitle: "VLK vs ROG · Přátelák",
                chips: [{ label: "Zkusí se znovu po opravě", tone: "warning" }],
            },
            cs
        ),
        [
            "-# **CHYBA BOTA · ZÁPAS**",
            "### Ohlášení zápasu se neodeslalo",
            "VLK vs ROG · Přátelák",
            "🟡 **Zkusí se znovu po opravě**",
        ]
    )
})

test("the panel frame lays out as the board's anatomy", () => {
    const layout = layoutMessageView(
        panelFrame({
            label: "Kalendář · Vlci",
            title: "Nejbližší akce",
            state: {
                chip: { label: "Stav", tone: "success" },
                detail: "krátký údaj ke stavu",
            },
            content: [{ kind: "text", markdown: "**Další:** VLK vs ROG" }],
            actions: [
                [
                    {
                        kind: "action",
                        id: "a",
                        label: "Hlavní akce",
                        style: "primary",
                    },
                    {
                        kind: "action",
                        id: "b",
                        label: "Další akce",
                        style: "secondary",
                    },
                    {
                        kind: "link",
                        url: "https://logi.app",
                        label: "Odkaz ven",
                    },
                ],
            ],
            updatedAt,
        }),
        cs
    )
    assert.equal(layout.accentColor, 0xe8a33d)
    assert.equal(layout.ephemeral, false)
    assert.deepEqual(
        layout.nodes.map((node) => node.type),
        ["text", "text", "separator", "buttons", "text"]
    )
    assert.deepEqual(layout.nodes[0], {
        type: "text",
        content:
            "-# **KALENDÁŘ · VLCI**\n### Nejbližší akce\n🟢 **Stav** · krátký údaj ke stavu",
    })
    assert.deepEqual(layout.nodes.at(-1), {
        type: "text",
        content: "-# Aktualizováno <t:1791741600:R> · Spravováno v Logi",
    })
})

test("an image that carries information sits next to the header in a section", () => {
    const layout = layoutMessageView(
        panelFrame({
            label: "Živé skóre · Wardogs",
            title: "Server klanu Vlci",
            state: {
                chip: { label: "Živě", tone: "success" },
                detail: "Zestafona · 17 / 98 hráčů",
            },
            image: {
                url: "attachment://zestafona.webp",
                description: "Zestafona",
            },
            updatedAt,
            refreshSeconds: 60,
            accentColor: "#4F9DE0",
        }),
        cs
    )
    assert.equal(layout.accentColor, 0x4f9de0)
    assert.equal(layout.nodes[0]?.type, "section")
    assert.deepEqual(
        layout.nodes[0]?.type === "section" && layout.nodes[0].thumbnail,
        { url: "attachment://zestafona.webp", description: "Zestafona" }
    )
    assert.equal(layout.nodes.at(-1)?.type, "text")
    assert.match(
        JSON.stringify(layout.nodes.at(-1)),
        /Aktualizováno <t:1791741600:R> · obnovuje se každých 60 s · Spravováno v Logi/
    )
})

test("a paused panel shows the paused chip with its time and keeps the bar", () => {
    const view = panelFrame({
        label: "Živé skóre · Hell Let Loose",
        title: "Vlci #1",
        state: { chip: { label: "Živě", tone: "success" } },
        updatedAt,
        paused: { reason: "server neodpovídá", since: "2026-10-11T19:02:00Z" },
    })
    const layout = layoutMessageView(view, {
        ...cs,
        style: { accentColor: "#112233" },
    })
    assert.equal(layout.accentColor, 0x112233)
    assert.match(
        JSON.stringify(layout.nodes[0]),
        /⚪ \*\*Pozastaveno\*\* · server neodpovídá · poslední data <t:1791745320:f>/
    )
    assert.doesNotMatch(JSON.stringify(layout), /Živě/)
})

test("the footer joins notes, time, refresh, page and the managed line in the clan language", () => {
    const copy = csKit
    assert.equal(
        footerText(
            {
                kind: "managed",
                notes: ["Body podle pravidel ECL"],
                updatedAt,
                updatedStyle: "f",
            },
            copy
        ),
        "Body podle pravidel ECL · Aktualizováno <t:1791741600:f> · Spravováno v Logi"
    )
    assert.equal(
        footerText({ kind: "managed", page: { page: 1, pages: 5 } }, copy),
        "Strana 1 z 5 · Spravováno v Logi"
    )
    assert.equal(
        footerText(
            {
                kind: "managed",
                managedUrl: "https://logi.app/cs/dashboard",
                updatedAt: "nonsense",
            },
            copy
        ),
        "[Spravováno v Logi](https://logi.app/cs/dashboard)"
    )
    assert.equal(
        footerText(
            {
                kind: "managed",
                notes: ["Hlášení k prověření."],
                managed: false,
            },
            copy
        ),
        "Hlášení k prověření."
    )
    assert.equal(
        footerText({ kind: "managed", updatedAt, refreshSeconds: 60 }, enKit),
        "Updated <t:1791741600:R> · refreshes every 60 s · Managed in Logi"
    )
})

test("the DM footer names the clan and links the message settings", () => {
    assert.equal(
        footerText(
            {
                kind: "dm",
                clanName: "Vlci",
                settingsUrl: "https://logi.app/cs/account#discord-dm",
            },
            csKit
        ),
        "Klan Vlci · [Nastavit zprávy](https://logi.app/cs/account#discord-dm)"
    )
    assert.equal(
        footerText({ kind: "dm", clanName: "**Wolves**" }, enKit),
        "Clan \\*\\*Wolves\\*\\* · Message settings"
    )
})

test("meta line icons follow the clan's icon density", () => {
    assert.equal(
        metaLineText({ text: "Foy", line: "details" }, "sparse"),
        "Foy"
    )
    assert.equal(
        metaLineText({ text: "Foy", line: "details" }, "rich"),
        "🗺️ Foy"
    )
    assert.equal(metaLineText({ text: "Foy", icon: "🗺️" }, undefined), "Foy")
    assert.equal(metaLineText({ text: "Foy", icon: "🗺️" }, "rich"), "🗺️ Foy")
    assert.equal(
        metaLineText({ text: "VLK", icon: "🛡️", iconAlways: true }, "sparse"),
        "🛡️ VLK"
    )
})

test("chips use the tone icon, which installed application emoji can replace", () => {
    assert.equal(
        chipText({ label: "Online", tone: "success" }),
        "🟢 **Online**"
    )
    assert.equal(
        chipText({ label: "Zrušeno", tone: "danger" }),
        "🔴 **Zrušeno**"
    )
    assert.equal(
        chipText(
            { label: "Sběr vypnutý", tone: "neutral" },
            { neutral: "<:off:1>" }
        ),
        "<:off:1> **Sběr vypnutý**"
    )
})

test("header labels are upper case in the clan locale and titles are escaped", () => {
    assert.deepEqual(
        headerLines(
            { label: "Hráči na serveru · Vlci #1", title: "Foy · *36* hráčů" },
            cs
        ),
        ["-# **HRÁČI NA SERVERU · VLCI #1**", "### Foy · \\*36\\* hráčů"]
    )
})

test("lists, fields, meta and galleries lay out as text and media nodes", () => {
    const view: MessageView = {
        accent: "system",
        header: {
            label: "Stav herních serverů · Wardogs",
            title: "3 servery klanu",
        },
        blocks: [
            {
                kind: "meta",
                lines: [
                    { text: "Uložený stav ze sběru dat, ne živá kontrola." },
                ],
            },
            {
                kind: "fields",
                items: [
                    {
                        title: "Vlci #1",
                        chip: { label: "Online", tone: "success" },
                        text: "17 / 98 hráčů",
                    },
                    {
                        title: "Vlci Event",
                        chip: { label: "Sběr vypnutý", tone: "neutral" },
                    },
                ],
            },
            {
                kind: "list",
                items: ["MNT · 8 b.", "VLK · 5 b."],
                marker: "number",
            },
            { kind: "gallery", items: [{ url: "https://logi.app/a.png" }] },
            { kind: "separator", divider: false, spacing: "large" },
        ],
    }
    const layout = layoutMessageView(view, cs)
    assert.equal(layout.accentColor, 0x80848e)
    assert.deepEqual(
        layout.nodes.map((node) => node.type),
        ["text", "text", "text", "separator", "text", "text", "gallery"],
        "a trailing separator without a footer is dropped"
    )
    assert.deepEqual(layout.nodes[2], {
        type: "text",
        content: "**Vlci #1** · 🟢 **Online**\n17 / 98 hráčů",
    })
    assert.deepEqual(layout.nodes[5], {
        type: "text",
        content: "1. MNT · 8 b.\n2. VLK · 5 b.",
    })
})

test("components and text are counted the way Discord counts them", () => {
    const layout = layoutMessageView(
        unknownErrorCard({
            title: "Tohle se nepovedlo",
            body: "Zkus to za chvíli znovu. Když to nepůjde, napiš správcům klanu.",
        }),
        cs
    )
    // container + header text + body text
    assert.equal(countLayoutComponents(layout), 3)
    assert.equal(
        layoutTextLength(layout),
        "### Tohle se nepovedlo".length +
            "Zkus to za chvíli znovu. Když to nepůjde, napiš správcům klanu."
                .length
    )
    const withSection = layoutMessageView(
        {
            accent: "clan",
            header: { title: "x", thumbnail: { url: "https://a.b/c.png" } },
            blocks: [
                {
                    kind: "buttons",
                    buttons: [{ kind: "link", url: "https://a.b", label: "A" }],
                },
                {
                    kind: "select",
                    select: { id: "s", options: [{ value: "v", label: "V" }] },
                },
            ],
        },
        cs
    )
    // container + section(1 + 1 text + thumbnail) + row(1 + 1 button) + row(1 + select)
    assert.equal(countLayoutComponents(withSection), 1 + 3 + 2 + 2)
})
