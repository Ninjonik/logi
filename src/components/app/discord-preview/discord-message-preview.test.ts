import assert from "node:assert/strict"
import test from "node:test"

import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"

import {
    errorCard,
    panelFrame,
    unknownErrorCard,
} from "@/domain/discord-messages/message-view"
import { getSystemMessages } from "@/lib/clan-language/system"
import { enMessages } from "@/i18n/messages/en"
import { csMessages } from "@/i18n/messages/cs"

import {
    DiscordMessagePreview,
    type DiscordMessagePreviewProps,
} from "./discord-message-preview"

const now = Date.parse("2026-10-11T18:02:00Z")
const render = (props: Partial<DiscordMessagePreviewProps>) =>
    renderToStaticMarkup(
        createElement(DiscordMessagePreview, {
            view: unknownErrorCard({ title: "x", body: "y" }),
            language: "cs",
            labels: csMessages.discordPreview,
            now,
            timeZone: "Europe/Prague",
            ...props,
        })
    )

/** The visible text, without markup. */
const textOf = (html: string) => html.replace(/<[^>]+>/g, "")

const frame = panelFrame({
    label: "Živé skóre · Hell Let Loose",
    title: "Vlci #1",
    state: {
        chip: { label: "Živě", tone: "success" },
        detail: "Foy · 36 / 100 hráčů",
    },
    image: { url: "https://logi.app/maps/foy.webp", description: "mapa Foy" },
    content: [
        {
            kind: "text",
            markdown:
                "**Další:** [VLK vs ROG](https://discord.com/channels/1/2/3)",
        },
        { kind: "meta", lines: [{ text: "Foy", line: "details" }] },
    ],
    actions: [
        [
            { kind: "action", id: "a", label: "Hlavní akce", style: "primary" },
            {
                kind: "action",
                id: "b",
                label: "Další akce",
                style: "secondary",
            },
            { kind: "link", url: "https://logi.app", label: "Odkaz ven" },
        ],
    ],
    updatedAt: "2026-10-11T18:00:00Z",
    refreshSeconds: 60,
})

test("the frame shows the accent bar, upper-case label, title, chip, image and footer", () => {
    const html = render({ view: frame })
    assert.match(html, /border-left-color:#e8a33d/)
    assert.match(html, /ŽIVÉ SKÓRE · HELL LET LOOSE/)
    assert.match(html, />Vlci #1</)
    assert.match(html, /background:#3ba55c[^>]*><\/span>Živě/)
    assert.match(html, /Foy · 36 \/ 100 hráčů/)
    assert.match(
        html,
        /<img src="https:\/\/logi.app\/maps\/foy.webp" alt="mapa Foy"/
    )
    assert.match(
        textOf(html),
        /Aktualizováno před 2 minutami · obnovuje se každých 60 s · Spravováno v Logi/
    )
})

test("markdown, links and buttons render with their Discord styles", () => {
    const html = render({ view: frame })
    assert.match(html, /<strong[^>]*><span>Další:<\/span><\/strong>/)
    assert.match(
        html,
        /<a href="https:\/\/discord.com\/channels\/1\/2\/3" target="_blank" rel="noreferrer noopener"[^>]*>(<span>)?VLK vs ROG/
    )
    assert.match(html, /bg-\[#5865f2\][^"]*"><span>Hlavní akce/)
    assert.match(html, /bg-\[#4e5058\][^"]*"><span>Další akce/)
    assert.match(
        html,
        /Odkaz ven<\/span><svg[^>]*>.*<span class="sr-only">\(odkaz ven\)/
    )
    assert.match(html, /aria-label="Tlačítka zprávy"/)
})

test("a private reply shows Discord's ephemeral line and the invoking command", () => {
    const html = render({
        view: errorCard({
            title: "Tento ticket můžou zavřít jen podpora a správci",
            body: "Ticket zavírá <@&1> nebo správci Logi. Kanál <#2>, autor <@3>.",
        }),
        mentions: { roles: { "1": "Admini" }, channels: { "2": "tickety" } },
        invokedBy: { user: "Hráč 17", command: "/close_ticket" },
        author: { time: "dnes v 20:14" },
    })
    assert.match(
        html,
        /Tuto zprávu vidíte jen vy ·<\/span><span[^>]*>Zavřít zprávu/
    )
    assert.match(html, /Hráč 17 použil\(a\) <span[^>]*>\/close_ticket<\/span>/)
    assert.match(html, />@Admini</)
    assert.match(html, />#tickety</)
    assert.match(html, />@uživatel</, "unknown mentions get a generic word")
    assert.match(
        html,
        />Logi<\/span><span[^>]*>APP<\/span><span[^>]*>dnes v 20:14/
    )
})

test("the clan language drives the bot's words; Discord's chrome follows the dashboard", () => {
    const copy = getSystemMessages("de").errors
    const html = render({
        view: unknownErrorCard({
            title: copy.unknownTitle,
            body: copy.unknownBody,
        }),
        language: "de",
        labels: enMessages.discordPreview,
    })
    assert.match(html, /Das hat nicht geklappt/)
    assert.match(html, /Only you can see this/)
})

test("paused panels show the grey paused chip with its time; the bar keeps the clan colour (L3-54)", () => {
    const html = render({
        view: panelFrame({
            label: "Živé skóre · Hell Let Loose",
            title: "Vlci #1",
            updatedAt: "2026-10-11T17:50:00Z",
            paused: {
                reason: "server neodpovídá",
                since: "2026-10-11T19:02:00Z",
            },
        }),
        style: { accentColor: "#4F9DE0" },
    })
    assert.match(html, /border-left-color:#4f9de0/)
    assert.match(html, /background:#80848e[^>]*><\/span>Pozastaveno/)
    assert.match(
        textOf(html),
        /server neodpovídá · poslední data 11\. října 2026 v 21:02/
    )
})

test("text from the bot is never rendered as HTML", () => {
    const html = render({
        view: errorCard({
            title: "<b>x</b>",
            body: "<img src=x onerror=alert(1)>",
        }),
    })
    assert.doesNotMatch(html, /<img src=x/)
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
})

test("without a fixed now, relative times show the absolute time so renders stay pure", () => {
    const html = render({ view: frame, now: undefined })
    assert.match(textOf(html), /Aktualizováno 11\. října 2026 v 20:00/)
})

test("a code block table keeps its columns and shows the ANSI-marked row bold", () => {
    const html = render({
        view: panelFrame({
            label: "Wardogs League · sezóna 2026",
            title: "WD League · tabulka",
            content: [
                {
                    kind: "text",
                    markdown:
                        "```ansi\n #  Tým    B\n\u001b[1;37m›3  VLK   13\u001b[0m\n```",
                },
            ],
            updatedAt: now,
        }),
    })
    assert.match(html, /<pre[^>]*>/)
    assert.match(html, /> #  Tým    B</)
    assert.match(
        html,
        /<span class="font-bold text-white">›3  VLK   13<\/span>/
    )
    assert.doesNotMatch(html, /\u001b|```|\[1;37m/)
})

test("the message text above the card follows the author line", () => {
    const text = textOf(
        render({
            view: frame,
            author: { time: "dnes v 18:02" },
            content: "@Klan",
        })
    )
    assert.ok(text.indexOf("dnes v 18:02") < text.indexOf("@Klan"))
    assert.ok(text.indexOf("@Klan") < text.indexOf("Vlci #1"))
})

test("the header subtitle renders under the title with its mentions", () => {
    const html = render({
        view: {
            accent: "system",
            header: {
                label: "Chyba bota · Zápas",
                title: "Ohlášení zápasu se neodeslalo",
                subtitle: "VLK vs ROG · Kanál <#100000000000000001>",
                chips: [{ label: "Zkusí se znovu po opravě", tone: "warning" }],
            },
            blocks: [],
        },
        mentions: { channels: { "100000000000000001": "oznameni" } },
    })
    const text = textOf(html)
    assert.ok(
        text.indexOf("Ohlášení zápasu se neodeslalo") <
            text.indexOf("VLK vs ROG")
    )
    assert.ok(text.indexOf("VLK vs ROG") < text.indexOf("Zkusí se znovu"))
    assert.match(text, /#oznameni/)
    assert.match(html, /border-left-color:#80848e/)
})

test("a custom emoji is drawn from Discord's emoji CDN, as Discord shows it (P2-B09)", () => {
    const html = render({
        view: {
            accent: "clan",
            blocks: [
                {
                    kind: "text",
                    markdown:
                        "Spojenci <:logi_us_1a2b3c4d:200000000000000021> 3 : 2",
                },
            ],
        },
    })
    assert.match(
        html,
        /<img[^>]*src="https:\/\/cdn\.discordapp\.com\/emojis\/200000000000000021\.webp\?size=48"[^>]*>/
    )
    assert.match(html, /alt=":logi_us_1a2b3c4d:"/)
    assert.doesNotMatch(textOf(html), /logi_us/)
})

test("chips carry the bot's installed status emoji instead of the dot (P2-B09)", () => {
    const view = panelFrame({
        label: "Živé skóre · Hell Let Loose",
        title: "Vlci #1",
        state: { chip: { label: "Živě", tone: "success" } },
        content: [
            {
                kind: "fields",
                items: [
                    {
                        title: "#38 · Friendly",
                        chip: { label: "Živě", tone: "success" },
                        text: "VLK vs ROG",
                    },
                ],
            },
        ],
        updatedAt: now,
    })
    const plain = render({ view })
    assert.doesNotMatch(plain, /cdn\.discordapp\.com\/emojis/)
    assert.match(plain, /background:#3ba55c/)
    const html = render({
        view,
        chipIcons: { success: "<:logi_live_1a2b3c4d:200000000000000025>" },
    })
    // Header chip and field chip, both drawn from Discord's emoji CDN.
    assert.equal(
        html.match(/cdn\.discordapp\.com\/emojis\/200000000000000025\.webp/g)
            ?.length,
        2
    )
    assert.doesNotMatch(html, /background:#3ba55c/)
    assert.equal(textOf(html).match(/Živě/g)?.length, 2)
})
