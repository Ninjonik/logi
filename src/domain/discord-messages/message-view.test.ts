import assert from "node:assert/strict"
import test from "node:test"

import {
    adminFixableErrorCard,
    CHIP_TONES,
    errorCard,
    escapeMarkdownText,
    notAllowedCard,
    pageButtons,
    pagedListReply,
    panelFrame,
    resolveMessageViewAccent,
    toUnixSeconds,
    unknownErrorCard,
    wrongPlaceCard,
    type MessageButton,
} from "./message-view"

const link: MessageButton = {
    kind: "link",
    url: "https://logi.app/servers",
    label: "Herní servery v Logi",
}

test("the chip tones are a fixed vocabulary", () => {
    assert.deepEqual(CHIP_TONES, [
        "success",
        "warning",
        "danger",
        "neutral",
        "info",
    ])
})

test("the bar is the clan colour, grey for system messages or a panel's own colour", () => {
    assert.equal(resolveMessageViewAccent("clan"), 0xe8a33d)
    assert.equal(
        resolveMessageViewAccent("clan", { accentColor: "#5865F2" }),
        0x5865f2
    )
    assert.equal(
        resolveMessageViewAccent("system", { accentColor: "#5865F2" }),
        0x80848e
    )
    assert.equal(resolveMessageViewAccent({ custom: "#4F9DE0" }), 0x4f9de0)
    // A broken panel colour falls back to the clan colour, never to a state colour.
    assert.equal(
        resolveMessageViewAccent(
            { custom: "orange" },
            { accentColor: "#112233" }
        ),
        0x112233
    )
})

test("timestamps become unix seconds; invalid input is dropped", () => {
    assert.equal(toUnixSeconds("2026-10-11T18:00:00Z"), 1791741600)
    assert.equal(toUnixSeconds(1791741600_999), 1791741600)
    assert.equal(toUnixSeconds(new Date(1791741600_000)), 1791741600)
    for (const value of ["nope", "", null, undefined, Number.NaN])
        assert.equal(toUnixSeconds(value), undefined)
})

test("plain text is escaped so names cannot format, mention or start a heading", () => {
    assert.equal(escapeMarkdownText("**Vlci**_x"), "\\*\\*Vlci\\*\\*\\_x")
    assert.equal(
        escapeMarkdownText("<@&123> <t:1:R>"),
        "\\<@&123\\> \\<t:1:R\\>"
    )
    assert.equal(escapeMarkdownText("# Title"), "\\# Title")
    assert.equal(escapeMarkdownText("> quote"), "\\> quote")
    assert.equal(escapeMarkdownText("- item"), "\\- item")
    assert.equal(escapeMarkdownText("1. item"), "1\\. item")
    assert.equal(escapeMarkdownText("two\nlines"), "two lines")
    assert.equal(escapeMarkdownText("[a](b)"), "\\[a\\](b)")
    assert.equal(
        escapeMarkdownText("VLK vs ROG · Přátelák"),
        "VLK vs ROG · Přátelák"
    )
})

test("an error card has the reason as title, the next step and no more than one button", () => {
    const card = errorCard({
        title: "Tohle nevypadá jako Steam64 ID",
        body: "Má 17 číslic a začíná 7656119. Najdeš ho podle návodu.",
        action: {
            kind: "action",
            id: "plink:retry",
            label: "Zadat znovu",
            style: "primary",
        },
    })
    assert.equal(card.ephemeral, true)
    assert.equal(card.accent, "clan")
    assert.deepEqual(card.header, { title: "Tohle nevypadá jako Steam64 ID" })
    assert.deepEqual(card.blocks[0], {
        kind: "text",
        markdown: "Má 17 číslic a začíná 7656119. Najdeš ho podle návodu.",
    })
    assert.equal(card.blocks.length, 2)
    assert.equal(card.footer, undefined)
    assert.equal(errorCard({ title: "A", body: "B" }).blocks.length, 1)
})

test("not allowed says who may, wrong place says where it works", () => {
    const notAllowed = notAllowedCard({
        title: "Tento ticket můžou zavřít jen podpora a správci",
        whoMay: "Ticket z kategorie Nahlásit hráče zavírá <@&1> nebo správci Logi.",
    })
    assert.deepEqual(notAllowed.blocks, [
        {
            kind: "text",
            markdown:
                "Ticket z kategorie Nahlásit hráče zavírá <@&1> nebo správci Logi.",
        },
    ])
    const wrongPlace = wrongPlaceCard({
        title: "/close_ticket funguje jen ve vlákně ticketu",
        whereItWorks: "Otevři vlákno ticketu a spusť příkaz tam.",
        action: link,
    })
    assert.equal(
        wrongPlace.header?.title,
        "/close_ticket funguje jen ve vlákně ticketu"
    )
    assert.deepEqual(wrongPlace.blocks[1], { kind: "buttons", buttons: [link] })
    assert.equal(wrongPlace.ephemeral, true)
})

test("an admin-fixable error tells the person only that admins were notified", () => {
    const card = adminFixableErrorCard({
        title: "Hlášení teď nejde poslat",
        adminNotified: "Správci dostali upozornění.",
    })
    assert.deepEqual(card.blocks, [
        { kind: "text", markdown: "Správci dostali upozornění." },
    ])
})

test("the unknown error card uses the given copy verbatim", () => {
    const card = unknownErrorCard({
        title: "Tohle se nepovedlo",
        body: "Zkus to za chvíli znovu. Když to nepůjde, napiš správcům klanu.",
    })
    assert.equal(card.header?.title, "Tohle se nepovedlo")
    assert.equal(card.ephemeral, true)
    assert.equal(card.accent, "clan")
})

test("the panel frame orders header, content, divider, buttons and footer", () => {
    const frame = panelFrame({
        label: "Živé skóre · Hell Let Loose",
        title: "Vlci #1",
        state: {
            chip: { label: "Živě", tone: "success" },
            detail: "Foy · 36 / 100 hráčů · zbývá 49 min",
        },
        image: { url: "https://logi.app/maps/foy.webp", description: "Foy" },
        content: [{ kind: "text", markdown: "**NEJVÍC ZABITÍ**" }],
        actions: [
            [
                {
                    kind: "action",
                    id: "panel:players",
                    label: "Zobrazit hráče",
                    style: "secondary",
                },
            ],
            [],
        ],
        updatedAt: "2026-10-11T18:00:00Z",
        refreshSeconds: 60,
    })
    assert.equal(frame.accent, "clan")
    assert.equal(frame.ephemeral, undefined)
    assert.deepEqual(frame.header?.chips, [{ label: "Živě", tone: "success" }])
    assert.equal(frame.header?.thumbnail?.url, "https://logi.app/maps/foy.webp")
    assert.deepEqual(
        frame.blocks.map((block) => block.kind),
        ["text", "separator", "buttons"]
    )
    assert.deepEqual(frame.footer, {
        kind: "managed",
        notes: undefined,
        updatedAt: "2026-10-11T18:00:00Z",
        refreshSeconds: 60,
        managedUrl: undefined,
    })
})

test("a panel without actions has no buttons and a custom colour only when set", () => {
    const frame = panelFrame({
        accentColor: " #4F9DE0 ",
        label: "Stav serveru · Hell Let Loose",
        title: "Vlci Trénink",
        updatedAt: 0,
    })
    assert.deepEqual(frame.accent, { custom: "#4F9DE0" })
    assert.deepEqual(
        frame.blocks.map((block) => block.kind),
        ["separator"]
    )
    assert.equal(
        panelFrame({ label: "x", title: "y", updatedAt: 0, accentColor: "  " })
            .accent,
        "clan"
    )
})

test("a paused panel drops content and buttons, keeps the bar and says since when", () => {
    const frame = panelFrame({
        accentColor: "#4F9DE0",
        label: "Živé skóre · Hell Let Loose",
        title: "Vlci #1",
        state: { chip: { label: "Živě", tone: "success" } },
        content: [{ kind: "text", markdown: "score" }],
        actions: [[link]],
        updatedAt: 1,
        paused: { reason: "server neodpovídá", since: "2026-10-11T19:02:00Z" },
    })
    assert.deepEqual(frame.accent, { custom: "#4F9DE0" })
    assert.deepEqual(frame.header?.paused, {
        reason: "server neodpovídá",
        since: "2026-10-11T19:02:00Z",
    })
    assert.deepEqual(
        frame.blocks.map((block) => block.kind),
        ["separator"]
    )
})

test("page buttons disable the ends and keep their custom IDs unique", () => {
    const first = pageButtons({
        page: 1,
        pages: 5,
        id: (page) => `players:${page}`,
        previousLabel: "Předchozí",
        nextLabel: "Další",
    })
    assert.deepEqual(
        first.map((button) => [
            button.label,
            button.kind === "action" && button.id,
            button.disabled,
        ]),
        [
            ["Předchozí", "players:0", true],
            ["Další", "players:2", false],
        ]
    )
    const only = pageButtons({
        page: 1,
        pages: 1,
        id: (page) => `p:${page}`,
        previousLabel: "<",
        nextLabel: ">",
    })
    assert.notEqual(
        only[0]!.kind === "action" && only[0]!.id,
        only[1]!.kind === "action" && only[1]!.id
    )
    assert.ok(only.every((button) => button.disabled))
})

test("a paged list reply shows one page of eight rows and the page in the footer", () => {
    const rows = Array.from({ length: 19 }, (_, index) => `Hráč ${index + 1}`)
    const reply = pagedListReply({
        label: "Hráči na serveru · Vlci #1",
        title: "Foy · 19 hráčů",
        meta: [{ text: "Jen aktuální kolo" }],
        rows,
        page: 3,
        id: (page) => `players:${page}`,
        previousLabel: "Předchozí",
        nextLabel: "Další",
    })
    assert.equal(reply.ephemeral, true)
    const list = reply.blocks.find((block) => block.kind === "list")
    assert.deepEqual(list && list.kind === "list" && list.items, [
        "Hráč 17",
        "Hráč 18",
        "Hráč 19",
    ])
    assert.deepEqual(reply.footer, {
        kind: "managed",
        page: { page: 3, pages: 3 },
    })
    const single = pagedListReply({
        title: "x",
        rows: ["a"],
        page: 9,
        id: String,
        previousLabel: "<",
        nextLabel: ">",
    })
    assert.equal(
        single.blocks.some((block) => block.kind === "buttons"),
        false,
        "one page needs no paging"
    )
})
