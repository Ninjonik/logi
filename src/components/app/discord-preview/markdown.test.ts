import assert from "node:assert/strict"
import test from "node:test"

import {
    parseAnsiLine,
    parseDiscordMarkdown,
    parseInlineMarkdown,
} from "./markdown"
import { formatPreviewTimestamp } from "./timestamp"

test("bold, italic, underline, strikethrough and code", () => {
    assert.deepEqual(
        parseInlineMarkdown("**Další:** _rychle_ __u__ ~~x~~ `c`"),
        [
            { type: "strong", children: [{ type: "text", text: "Další:" }] },
            { type: "text", text: " " },
            { type: "em", children: [{ type: "text", text: "rychle" }] },
            { type: "text", text: " " },
            { type: "underline", children: [{ type: "text", text: "u" }] },
            { type: "text", text: " " },
            { type: "strike", children: [{ type: "text", text: "x" }] },
            { type: "text", text: " " },
            { type: "code", text: "c" },
        ]
    )
    assert.deepEqual(parseInlineMarkdown("*a **b** c*"), [
        {
            type: "em",
            children: [
                { type: "text", text: "a " },
                { type: "strong", children: [{ type: "text", text: "b" }] },
                { type: "text", text: " c" },
            ],
        },
    ])
})

test("masked and bare links accept only http(s)", () => {
    assert.deepEqual(
        parseInlineMarkdown("[VLK vs ROG](https://discord.com/channels/1/2/3)"),
        [
            {
                type: "link",
                href: "https://discord.com/channels/1/2/3",
                children: [{ type: "text", text: "VLK vs ROG" }],
            },
        ]
    )
    assert.deepEqual(parseInlineMarkdown("viz https://logi.app/x."), [
        { type: "text", text: "viz " },
        {
            type: "link",
            href: "https://logi.app/x",
            children: [{ type: "text", text: "https://logi.app/x" }],
        },
        { type: "text", text: "." },
    ])
    assert.deepEqual(parseInlineMarkdown("[x](javascript:alert(1))"), [
        { type: "text", text: "[x](javascript:alert(1))" },
    ])
})

test("timestamps, mentions and custom emoji become their own tokens", () => {
    assert.deepEqual(
        parseInlineMarkdown(
            "<t:1791741600:R> <t:1791741600> <@1> <@!2> <@&3> <#4> <:off:5>"
        ),
        [
            { type: "timestamp", unix: 1791741600, style: "R" },
            { type: "text", text: " " },
            { type: "timestamp", unix: 1791741600, style: "f" },
            { type: "text", text: " " },
            { type: "mention", kind: "user", id: "1" },
            { type: "text", text: " " },
            { type: "mention", kind: "user", id: "2" },
            { type: "text", text: " " },
            { type: "mention", kind: "role", id: "3" },
            { type: "text", text: " " },
            { type: "mention", kind: "channel", id: "4" },
            { type: "text", text: " " },
            { type: "emoji", name: "off", id: "5", animated: false },
        ]
    )
})

test("escaped characters stay literal, as the bot's escaping intends", () => {
    assert.deepEqual(parseInlineMarkdown("\\*\\*Vlci\\*\\* \\<@&1\\> 1\\."), [
        { type: "text", text: "**Vlci** <@&1> 1." },
    ])
    assert.deepEqual(parseInlineMarkdown("<script>x</script>"), [
        { type: "text", text: "<script>x</script>" },
    ])
})

test("blocks: subtext, headings, quotes and paragraphs per line", () => {
    const blocks = parseDiscordMarkdown(
        "-# **KALENDÁŘ**\n### Nejbližší akce\n> Kolem 20:30\n> končím v práci.\ntext"
    )
    assert.deepEqual(
        blocks.map((block) => [block.type, block.lines.length]),
        [
            ["subtext", 1],
            ["h3", 1],
            ["quote", 2],
            ["paragraph", 1],
        ]
    )
})

test("preview timestamps follow the clan language", () => {
    const now = Date.parse("2026-10-11T18:02:00Z")
    const unix = 1791741600 // 2026-10-11T18:00:00Z
    assert.equal(
        formatPreviewTimestamp({ unix, style: "R", language: "cs", now }),
        "před 2 minutami"
    )
    assert.equal(
        formatPreviewTimestamp({
            unix,
            style: "f",
            language: "cs",
            now,
            timeZone: "Europe/Prague",
        }),
        "11. října 2026 v 20:00"
    )
    assert.equal(
        formatPreviewTimestamp({
            unix,
            style: "t",
            language: "de",
            now,
            timeZone: "Europe/Berlin",
        }),
        "20:00"
    )
    assert.equal(
        formatPreviewTimestamp({ unix, style: "R", language: "en", now }),
        "2 minutes ago"
    )
})

test("underscores inside names never start italics, as in Discord", () => {
    assert.deepEqual(parseInlineMarkdown("Rex_CZ · 31 · Hans_88 · 28"), [
        { type: "text", text: "Rex_CZ · 31 · Hans_88 · 28" },
    ])
    assert.deepEqual(parseInlineMarkdown("a _b_ c"), [
        { type: "text", text: "a " },
        { type: "em", children: [{ type: "text", text: "b" }] },
        { type: "text", text: " c" },
    ])
    assert.deepEqual(parseInlineMarkdown("_x_y z_"), [
        { type: "em", children: [{ type: "text", text: "x_y z" }] },
    ])
})

test("fenced code blocks keep spacing and turn ANSI bold white into emphasis, never into text", () => {
    const blocks = parseDiscordMarkdown(
        "Po 5 zápasech\n```ansi\n #  Tým    B\n\u001b[1;37m›2  VLK    5\u001b[0m\n```\n-# legenda"
    )
    assert.deepEqual(blocks, [
        {
            type: "paragraph",
            lines: [[{ type: "text", text: "Po 5 zápasech" }]],
        },
        {
            type: "code",
            language: "ansi",
            lines: [
                [{ text: " #  Tým    B", strong: false }],
                [{ text: "›2  VLK    5", strong: true }],
            ],
        },
        { type: "subtext", lines: [[{ type: "text", text: "legenda" }]] },
    ])
    assert.deepEqual(parseAnsiLine("\u001b[31mred\u001b[0m plain", false), [
        { text: "red plain", strong: false },
    ])
    // An unclosed fence keeps the rest as code instead of losing it.
    assert.equal(parseDiscordMarkdown("```\n**x**").at(0)?.type, "code")
})
