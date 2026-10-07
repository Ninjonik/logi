import assert from "node:assert/strict"
import test from "node:test"

import type { Client, ContainerBuilder } from "discord.js"

import {
    buildAttendanceReminderDm,
    playersWithAbsenceNotice,
    processAttendanceReminders,
    rosterPlaces,
} from "./attendance-reminders"
import type { AutomaticReminderOutcome } from "./reminder-outcomes"
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

test("the reminder's buttons name the clan's server, so a click after the match is gone keeps the clan language", () => {
    // L1-B19, L2-B01: a DM click has no server of its own.
    const content = json(
        buildAttendanceReminderDm({
            payload,
            event: { ...event, guildId: "900000000000000001" },
            now: Date.parse("2026-10-10T17:30:00.000Z"),
        })
    )
    for (const prefix of [
        "attendance-confirm",
        "attendance-late",
        "attendance-decline",
    ])
        assert.match(
            content,
            new RegExp(`"custom_id":"${prefix}:event-1:900000000000000001"`)
        )
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

test("players a scheduled reminder did not reach are recorded for the match page (L2-64)", async () => {
    const recorded: AutomaticReminderOutcome[] = []
    const meetingStart = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const due = {
        ...event,
        status: "starting",
        meetingStart,
        gameStart: meetingStart,
        attendanceReminderLog: [],
        absenceNotices: [],
    } as unknown as EventRecord
    const client = {
        guilds: {
            fetch: async () => ({
                name: "Vlci",
                members: { fetch: async () => new Map() },
            }),
        },
        users: {
            // reserve-1 cannot be fetched; the medic has closed DMs.
            fetch: async (id: string) =>
                id === "medic"
                    ? {
                          send: async () => {
                              throw Object.assign(
                                  new Error(
                                      "Cannot send messages to this user"
                                  ),
                                  { code: 50007 }
                              )
                          },
                      }
                    : null,
        },
    } as unknown as Client
    await processAttendanceReminders(
        client,
        new Set(),
        {
            ...payload,
            events: [due],
            rosters: [roster],
            userDisplayNames: {},
        } as unknown as SyncPayload,
        new Set([due.id]),
        async (outcome) => {
            recorded.push(outcome)
        }
    )
    // All four offsets are due an hour before the meeting; the nearest runs.
    assert.deepEqual(recorded, [
        {
            guildId: "guild-1",
            eventId: "event-1",
            kind: "attendance",
            runKey: "6h",
            sentUserIds: [],
            failedUserIds: ["medic", "reserve-1"],
        },
    ])
})
