import assert from "node:assert/strict"
import test from "node:test"

import { getAnnouncementMessages } from "@/lib/clan-language/announcements"

import {
    buildScheduledEventContent,
    resolveScheduledEventEndTime,
} from "./scheduled-event-content"

const base = {
    kind: "match" as const,
    title: "VLK vs ROG · Přátelák",
    category: "Přátelák",
    opponent: "ROG",
    side: "Allies",
    mapLabel: "Foy · den",
    hasPassword: true,
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    announcementChannelId: "111111111111111111",
    locale: "cs-CZ",
    timeZone: "Europe/Prague",
    copy: getAnnouncementMessages("cs"),
}

test("the scheduled event reads like the board in the clan language (L1-138, L1-139)", () => {
    const content = buildScheduledEventContent(base)
    assert.equal(content.name, "VLK vs ROG · Přátelák")
    assert.equal(
        content.description,
        [
            "Přátelák proti ROG, hrajeme za Spojence.",
            "Sraz 19:30, start 20:00 · Foy · den",
            "Přihláška a soupiska: <#111111111111111111>",
            "Heslo k serveru dostanou hráči na soupisce pod Zobrazit zařazení.",
        ].join("\n")
    )
})

test("the scheduled event never carries the raw map, the raw side or a password", () => {
    const content = buildScheduledEventContent({
        ...base,
        server: "VLK Scrim",
    })
    assert.doesNotMatch(content.description, /foy_warfare_day|Allies|k7-sraz/)
    assert.doesNotMatch(content.description, /VLK Scrim/)
})

test("missing facts drop their part of the sentence", () => {
    const copy = getAnnouncementMessages("cs")
    assert.match(
        buildScheduledEventContent({ ...base, opponent: null }).description,
        /^Přátelák, hrajeme za Spojence\./
    )
    assert.match(
        buildScheduledEventContent({ ...base, side: null }).description,
        /^Přátelák proti ROG\./
    )
    assert.match(
        buildScheduledEventContent({
            ...base,
            category: null,
            side: "Axis",
        }).description,
        /^Zápas proti ROG, hrajeme za Osu\./
    )
    assert.doesNotMatch(
        buildScheduledEventContent({ ...base, hasPassword: false }).description,
        new RegExp(copy.scheduledEvent.password)
    )
})

test("a training names its server and its sign-up channel", () => {
    const content = buildScheduledEventContent({
        ...base,
        kind: "training",
        title: "Trénink · komunikace a souhra",
        server: "Vlci Trénink",
        meetingStart: "2026-10-12T16:45:00.000Z",
        gameStart: "2026-10-12T17:00:00.000Z",
    })
    assert.equal(
        content.description,
        [
            "Sraz 18:45, start 19:00",
            "Přihláška: <#111111111111111111>",
            "Server Vlci Trénink",
        ].join("\n")
    )
})

test("English and German clans read their own language", () => {
    assert.match(
        buildScheduledEventContent({
            ...base,
            locale: "en-GB",
            copy: getAnnouncementMessages("en"),
        }).description,
        /^Přátelák against ROG, we play Allies\./
    )
    assert.match(
        buildScheduledEventContent({
            ...base,
            locale: "de-DE",
            copy: getAnnouncementMessages("de"),
        }).description,
        /Treffen 19:30, Start 20:00/
    )
})

test("resolveScheduledEventEndTime falls back to ninety minutes after meeting start", () => {
    const endTime = resolveScheduledEventEndTime({
        meetingStart: "2026-01-01T10:00:00.000Z",
        gameEnd: "invalid",
    })

    assert.equal(endTime.toISOString(), "2026-01-01T11:30:00.000Z")
})
