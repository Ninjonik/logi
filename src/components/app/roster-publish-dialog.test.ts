import assert from "node:assert/strict"
import test from "node:test"

import { enMessages } from "@/i18n/messages/en"
import { deMessages } from "@/i18n/messages/de"
import { csMessages } from "@/i18n/messages/cs"
import type { Roster } from "@/types/domain"

import {
    publishChanges,
    publishedDayTime,
    rosterCounters,
} from "./roster-publish-dialog"

const squad = (
    name: string,
    players: Roster["squads"][number]["players"]
): Roster["squads"][number] => ({
    name,
    group: "Pěchota",
    order: 0,
    color: "#000000",
    players,
})

const saved: Roster = {
    id: "roster-1",
    eventId: "event-1",
    guildId: "guild-1",
    published: true,
    publishedAt: "2026-10-10T19:12:00.000Z",
    createdAt: "2026-10-09T19:12:00.000Z",
    updatedAt: "2026-10-10T19:12:00.000Z",
    squads: [
        squad("F1", [
            { id: "rex", roleName: "Squad Leader", ack: true },
            { id: "sova", roleName: "Support", ack: false },
            { id: "liska", roleName: "Rifleman", ack: false },
            { customName: "Host", ack: false },
            { ack: false },
        ]),
    ],
    reservePlayerIds: ["stekot"],
    notAttendingPlayerIds: ["kos"],
}

test("the counters count filled slots, reserves and absentees (D5-10)", () => {
    assert.deepEqual(rosterCounters(saved), {
        rostered: 4,
        reserves: 1,
        notAttending: 1,
    })
})

test("a first publish lists no changes", () => {
    assert.deepEqual(publishChanges(undefined, saved), [])
    assert.deepEqual(publishChanges({ ...saved, published: false }, saved), [])
})

test("the dialog compares with the version the server stored at the last publish (D5-B04)", () => {
    // Since that publish a decline moved Zubr out of the squads; the stored
    // version still has him, as the digest and the DMs will.
    const stored: Roster = {
        ...saved,
        publishedPlaces: [
            { userId: "rex", squad: "F1", role: "Squad Leader" },
            { userId: "zubr", squad: "F1", role: "Rifleman" },
        ],
    }
    const changes = publishChanges(stored, stored)
    const byUser = new Map(changes.map((change) => [change.userId, change]))
    assert.equal(byUser.get("zubr")?.removed, true)
    assert.equal(byUser.has("rex"), false)
})

test("a re-publish lists the changes against the last published version", () => {
    const draft: Roster = {
        ...saved,
        squads: [
            squad("F1", [
                { id: "rex", roleName: "Squad Leader", ack: true },
                { id: "sova", roleName: "Anti-Tank", ack: false },
                { id: "zubr", roleName: "Rifleman", ack: false },
            ]),
        ],
        reservePlayerIds: ["stekot", "liska"],
    }
    const changes = publishChanges(saved, draft)
    const byUser = new Map(changes.map((change) => [change.userId, change]))
    assert.equal(byUser.get("zubr")?.added, true)
    assert.equal(byUser.get("liska")?.removed, true)
    assert.equal(byUser.get("liska")?.toReserves, true)
    assert.equal(byUser.get("sova")?.roleChanged, true)
    assert.equal(byUser.has("rex"), false)
})

test("the dialog copy exists in every locale with the same keys", () => {
    const keys = (value: object) => Object.keys(value).sort()
    for (const messages of [enMessages, deMessages]) {
        assert.deepEqual(
            keys(messages.rosterPublish),
            keys(csMessages.rosterPublish)
        )
        assert.deepEqual(
            keys(messages.reminderDelivery),
            keys(csMessages.reminderDelivery)
        )
    }
})

test("the published time reads today, yesterday or a date in the clan's zone (D5-13, D5-14)", () => {
    // Tuesday 6 October 2026, 20:00 in Prague.
    const now = Date.parse("2026-10-06T18:00:00.000Z")
    const cs = csMessages.rosterPublish
    const at = (
        iso: string,
        locale = "cs-CZ",
        text: Parameters<typeof publishedDayTime>[4] = cs
    ) => publishedDayTime(iso, now, locale, "Europe/Prague", text)
    assert.equal(at("2026-10-06T16:40:00.000Z"), "dnes v 18:40")
    assert.equal(at("2026-10-05T16:40:00.000Z"), "včera v 18:40")
    assert.equal(at("2026-10-03T16:40:00.000Z"), "so 3. 10. v 18:40")
    // The clan's calendar day, not UTC's: 23:30 UTC is already tomorrow.
    assert.equal(at("2026-10-05T22:30:00.000Z"), "dnes v 00:30")
    assert.equal(
        cs.publishedAt.replace("{time}", at("2026-10-06T16:40:00.000Z")!),
        "zveřejněno dnes v 18:40"
    )
    assert.equal(
        cs.changesAgainst.replace("{time}", at("2026-10-06T16:40:00.000Z")!),
        "Proti verzi zveřejněné dnes v 18:40."
    )
    assert.equal(
        at("2026-10-05T16:40:00.000Z", "en-GB", enMessages.rosterPublish),
        "yesterday at 18:40"
    )
    assert.equal(
        at("2026-10-06T16:40:00.000Z", "de-DE", deMessages.rosterPublish),
        "heute um 18:40"
    )
    assert.equal(at("not a date"), undefined)
    assert.equal(at(""), undefined)
})
