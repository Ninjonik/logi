import assert from "node:assert/strict"
import test from "node:test"

import type { GuildBasedChannel } from "discord.js"

import {
    buildErrorReport,
    inferErrorSource,
    type ErrorReportContext,
} from "../error-reporting"

const CHANNEL = "100000000000000021"

const context: ErrorReportContext = {
    errorsChannelId: "100000000000000009",
    language: "cs",
    timeZone: "Europe/Prague",
    messageStyle: null,
    serverId: "k17server",
    channels: {},
    event: null,
}

type Json = Record<string, unknown>
function texts(value: unknown): string[] {
    if (!value || typeof value !== "object") return []
    if (Array.isArray(value)) return value.flatMap(texts)
    const record = value as Json
    return [
        ...(typeof record.content === "string" ? [record.content] : []),
        ...texts(record.components),
        ...texts(record.accessory),
    ]
}

test("a password removed from a panel has its own errors-channel entry (P4-30, P4-B06)", async () => {
    const message = await buildErrorReport(
        {
            guildId: "1",
            error: null,
            source: "panelPassword",
            channelId: CHANNEL,
            panelName: "Vlci #2 · Trénink a zápasy",
        },
        context,
        {
            guild: null,
            me: null,
            channel: async (id) =>
                id === CHANNEL
                    ? ({
                          id: CHANNEL,
                          name: "klan-server",
                      } as GuildBasedChannel)
                    : null,
        },
        "https://logi.example"
    )
    assert.ok(message)
    const text = texts(
        (message.components ?? []).map((component) =>
            "toJSON" in component
                ? (component as { toJSON(): unknown }).toJSON()
                : component
        )
    ).join("\n")
    assert.match(text, /CHYBA BOTA · PANELY/)
    assert.match(text, /### Bot odstranil heslo z panelu/)
    assert.match(
        text,
        /Panel Vlci #2 · Trénink a zápasy · Kanál <#100000000000000021>/
    )
    assert.match(
        text,
        /Kanál <#100000000000000021> vidí všichni \(@everyone\)\. Heslo serveru tu zobrazit nejde\./
    )
    assert.match(
        text,
        /Nastav kanál jako soukromý\. Logi heslo ukáže jen v kanálu, který @everyone nevidí\. Ověří to při každém obnovení panelu\./
    )
    // Never the generic "Discord refused" card the notice used to become.
    assert.doesNotMatch(text, /Discord akci odmítl|Bot nemohl dokončit akci/)
    assert.equal(inferErrorSource({ scope: "panel-password" }), "panelPassword")
})
