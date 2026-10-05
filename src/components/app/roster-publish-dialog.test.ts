import assert from "node:assert/strict"
import test from "node:test"

import { enMessages } from "@/i18n/messages/en"
import { deMessages } from "@/i18n/messages/de"
import { csMessages } from "@/i18n/messages/cs"
import type { Roster } from "@/types/domain"

import { publishChanges, rosterCounters } from "./roster-publish-dialog"

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
