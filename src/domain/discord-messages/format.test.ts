import assert from "node:assert/strict"
import test from "node:test"

import {
    DEFAULT_MESSAGE_ACCENT_COLOR,
    DEFAULT_MESSAGE_ACCENT_HEX,
    SYSTEM_MESSAGE_ACCENT_COLOR,
    discordTimestamp,
    fillTemplate,
    findSquadLeader,
    formatCount,
    isSquadLeaderRole,
    parseDiscordColor,
    resolveMessageAccentColor,
} from "./format"

test("parseDiscordColor accepts six-digit hex colours only", () => {
    assert.equal(parseDiscordColor("#E8A33D"), 0xe8a33d)
    assert.equal(parseDiscordColor(" e8a33d "), 0xe8a33d)
    assert.equal(parseDiscordColor("#abc"), undefined)
    assert.equal(parseDiscordColor("red"), undefined)
    assert.equal(parseDiscordColor(null), undefined)
})

test("the default clan accent is #E8A33D and system messages are neutral grey", () => {
    assert.equal(DEFAULT_MESSAGE_ACCENT_COLOR, 0xe8a33d)
    assert.equal(
        parseDiscordColor(DEFAULT_MESSAGE_ACCENT_HEX),
        DEFAULT_MESSAGE_ACCENT_COLOR
    )
    assert.equal(SYSTEM_MESSAGE_ACCENT_COLOR, 0x80848e)
    assert.equal(resolveMessageAccentColor({}), 0xe8a33d)
})

test("message accent prefers the category, then the clan colour, then Logi amber", () => {
    assert.equal(
        resolveMessageAccentColor({
            categoryColor: "#dc2626",
            clanColor: "#E8A33D",
        }),
        0xdc2626
    )
    assert.equal(resolveMessageAccentColor({ clanColor: "#E8A33D" }), 0xe8a33d)
    assert.equal(
        resolveMessageAccentColor({ categoryColor: "nope", clanColor: "" }),
        DEFAULT_MESSAGE_ACCENT_COLOR
    )
})

test("the clan's message style supplies the clan colour", () => {
    const messageStyle = { accentColor: "#5865F2" }
    assert.equal(resolveMessageAccentColor({ messageStyle }), 0x5865f2)
    // An event category still wins.
    assert.equal(
        resolveMessageAccentColor({ categoryColor: "#dc2626", messageStyle }),
        0xdc2626
    )
    // A broken or missing style falls back to Logi amber.
    assert.equal(
        resolveMessageAccentColor({ messageStyle: { accentColor: "blue" } }),
        DEFAULT_MESSAGE_ACCENT_COLOR
    )
    assert.equal(
        resolveMessageAccentColor({ messageStyle: null }),
        DEFAULT_MESSAGE_ACCENT_COLOR
    )
})

test("discordTimestamp renders Discord markup and rejects invalid dates", () => {
    assert.equal(
        discordTimestamp("2026-10-11T18:00:00.000Z", "t"),
        "<t:1791741600:t>"
    )
    assert.equal(discordTimestamp(1791741600999, "R"), "<t:1791741600:R>")
    assert.equal(discordTimestamp("not a date", "F"), undefined)
    assert.equal(discordTimestamp(undefined, "F"), undefined)
})

test("formatCount picks the plural form of the clan language", () => {
    const czech = {
        one: "{count} hráč",
        few: "{count} hráči",
        many: "{count} hráče",
        other: "{count} hráčů",
    }
    assert.equal(formatCount("cs-CZ", 1, czech), "1 hráč")
    assert.equal(formatCount("cs-CZ", 2, czech), "2 hráči")
    assert.equal(formatCount("cs-CZ", 6, czech), "6 hráčů")
    assert.equal(formatCount("cs-CZ", 0, czech), "0 hráčů")
    const english = { one: "{count} player", other: "{count} players" }
    assert.equal(formatCount("en-GB", 1, english), "1 player")
    assert.equal(formatCount("en-GB", 3, english), "3 players")
    assert.equal(formatCount("not a locale!", 1, english), "1 player")
})

test("fillTemplate replaces known placeholders only", () => {
    assert.equal(
        fillTemplate("Sraz {time} v kanálu {channel}", {
            time: "<t:1:t>",
            channel: "<#2>",
        }),
        "Sraz <t:1:t> v kanálu <#2>"
    )
    assert.equal(fillTemplate("{missing} stays", {}), "{missing} stays")
})

test("squad leaders are recognised from common Hell Let Loose role names", () => {
    for (const role of [
        "Officer",
        "Squad Leader",
        "SL",
        "Tank Commander",
        "Spotter",
        "Commander",
        "Velitel čety",
    ]) {
        assert.equal(isSquadLeaderRole(role), true, role)
    }
    for (const role of ["Medic", "Rifleman", "Sniper", "", undefined]) {
        assert.equal(isSquadLeaderRole(role), false, String(role))
    }
    assert.deepEqual(
        findSquadLeader([
            { id: "a", roleName: "Medic" },
            { id: "b", roleName: "Officer" },
            { id: "c", roleName: "Squad Leader" },
        ]),
        { id: "b", roleName: "Officer" }
    )
    assert.equal(
        findSquadLeader<{ id: string; roleName?: string }>([{ id: "a" }]),
        undefined
    )
})
