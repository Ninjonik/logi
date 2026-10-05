import assert from "node:assert/strict"
import test from "node:test"

import type { ContainerBuilder } from "discord.js"

import {
    buildAttendanceReminderDm,
    playersWithAbsenceNotice,
    rosterPlaces,
} from "./attendance-reminders"
import type { EventRecord, Roster, SyncPayload } from "../types"

const payload = {
    config: {
        id: "config-1",
        guildId: "guild-1",
        timezone: "Europe/Prague",
        defaultLanguage: "cs",
        calendarCategories: [],
        updatedAt: "2026-10-01T10:00:00.000Z",
    },
    guild: { name: "Vlci", eventCategories: [] },
} as unknown as Pick<SyncPayload, "config" | "guild">

const event = {
    id: "event-1",
    name: "Liga",
    matchTeams: [
        {
            slot: "a",
            side: "Allies",
            snapshot: { name: "Vlci", shortCode: "VLK" },
        },
        {
            slot: "b",
            side: "Axis",
            snapshot: { name: "Rogue", shortCode: "ROG" },
        },
    ],
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
} as unknown as EventRecord

const roster = {
    id: "roster-1",
    eventId: "event-1",
    published: true,
    reservePlayerIds: ["reserve-1", "reserve-2"],
    reserveAttendances: [{ userId: "reserve-2", ack: true }],
    updatedAt: "2026-10-01T10:00:00.000Z",
    squads: [
        {
            name: "F1",
            group: "Pěchota",
            order: 0,
            color: "#000",
            players: [
                {
                    id: "100000000000000001",
                    ack: true,
                    roleName: "Squad Leader",
                },
                { id: "medic", ack: false, roleName: "Medic", note: "*bold*" },
            ],
        },
    ],
} as unknown as Roster

const json = (message: { components: ContainerBuilder[] }) =>
    JSON.stringify(message.components.map((item) => item.toJSON()))

test("the reminder DM: label, weekday schedule, place with the leader, buttons and footer", () => {
    const places = rosterPlaces(roster, { "100000000000000001": "Rex_CZ" })
    const content = json(
        buildAttendanceReminderDm({
            payload,
            event,
            place: places.get("medic"),
            now: Date.parse("2026-10-10T17:30:00.000Z"),
        })
    )
    assert.match(content, /PŘIPOMÍNKA DOCHÁZKY/)
    assert.match(content, /### Zítra hraješ VLK vs ROG/)
    assert.match(
        content,
        /ne <t:1791741600:d> · sraz <t:1791739800:t> · start <t:1791741600:t>/
    )
    assert.match(content, /\*\*F1 · Medic\*\* · velitel čety Rex\\\\_CZ/)
    assert.match(content, /Potvrď, ať velení ví, s kým počítat\./)
    assert.match(content, /Klan Vlci · \[Nastavit zprávy\]/)
    assert.match(content, /attendance-confirm:event-1/)
    assert.doesNotMatch(content, /heslo|password/i)
})

test("only unconfirmed players and reserves are reminded", () => {
    const places = rosterPlaces(roster, {})
    assert.deepEqual([...places.keys()], ["medic", "reserve-1"])
    assert.deepEqual(places.get("reserve-1"), { kind: "reserve" })
    assert.deepEqual(
        [...rosterPlaces(roster, {}, { includeAcknowledged: true }).keys()],
        ["100000000000000001", "medic", "reserve-1", "reserve-2"]
    )
})

test("the title says today or tomorrow in the clan's time zone", () => {
    const title = (now: string) =>
        json(
            buildAttendanceReminderDm({ payload, event, now: Date.parse(now) })
        ).match(/### ([^"\\]+)/)?.[1]
    assert.equal(title("2026-10-10T17:30:00.000Z"), "Zítra hraješ VLK vs ROG")
    assert.equal(title("2026-10-11T08:00:00.000Z"), "Dnes hraješ VLK vs ROG")
    assert.equal(title("2026-10-08T17:30:00.000Z"), "Hraješ VLK vs ROG")
    assert.equal(title("2026-10-10T22:30:00.000Z"), "Dnes hraješ VLK vs ROG")
})

test("players who declined or sent a notice get no further reminders", () => {
    assert.deepEqual(
        [
            ...playersWithAbsenceNotice({
                absenceNotices: [{ userId: "player-1" }],
            }),
        ],
        ["player-1"]
    )
    assert.equal(playersWithAbsenceNotice({}).size, 0)
})
