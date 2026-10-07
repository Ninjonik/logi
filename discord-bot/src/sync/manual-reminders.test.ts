import assert from "node:assert/strict"
import test from "node:test"

import type { ContainerBuilder } from "discord.js"

import type { EventRecord, Roster, SyncPayload } from "../types"
import { deliverManualReminder } from "./manual-reminders"

const event = {
    id: "event-1",
    guildId: "guild-1",
    kind: "match",
    name: "VLK vs ROG",
    requiredRoleIds: [],
    rewardRoleIds: [],
    registrationEnd: "2099-01-01T12:30:00.000Z",
    meetingStart: "2099-01-01T13:00:00.000Z",
    gameStart: "2099-01-01T14:00:00.000Z",
    gameEnd: "2099-01-01T16:00:00.000Z",
    pingClan: false,
    createForumChannel: false,
    status: "registration",
    statusUpdatedAt: "2026-07-29T10:00:00.000Z",
    attendanceReminderLog: [],
    signUps: [],
    participants: [],
    updatedAt: "2026-07-29T10:00:00.000Z",
} as unknown as EventRecord

const roster = {
    id: "roster-1",
    eventId: "event-1",
    published: true,
    reservePlayerIds: ["reserve-1"],
    updatedAt: "2026-07-29T10:00:00.000Z",
    squads: [
        {
            name: "Able",
            group: "Infantry",
            order: 0,
            color: "#dc2626",
            players: [
                { id: "100000000000000001", ack: true, roleName: "Officer" },
                { id: "slot-1", ack: false, roleName: "Medic" },
            ],
        },
    ],
} as unknown as Roster

const payload = {
    config: {
        id: "config-1",
        guildId: "guild-1",
        timezone: "Europe/Prague",
        defaultLanguage: "cs",
        calendarCategories: [],
        updatedAt: "2026-07-29T10:00:00.000Z",
    },
    groups: [],
    guild: { name: "Vlci", eventCategories: [] },
    rosters: [roster],
    userDisplayNames: { "100000000000000001": "Rex_CZ" },
    events: [event],
    calendarItems: [],
    topicPresets: [],
    syncStates: [],
    assignments: [],
} as unknown as SyncPayload

function recorder(failFor: string[] = []) {
    const sent: Array<{ userId: string; message: unknown }> = []
    return {
        sent,
        send: async (userId: string, message: unknown) => {
            sent.push({ userId, message })
            return !failFor.includes(userId)
        },
    }
}

const json = (message: unknown) =>
    JSON.stringify(
        (message as { components: ContainerBuilder[] }).components.map((item) =>
            item.toJSON()
        )
    )

test("unanswered members get the sign-up reminder; closed DMs are returned by name", async () => {
    const { sent, send } = recorder(["closed-dm"])
    const delivery = await deliverManualReminder({
        payload,
        request: {
            id: "request-1",
            eventId: "event-1",
            guildId: "guild-1",
            audience: "unanswered",
            recipientIds: ["member-1", "closed-dm"],
        },
        send,
    })
    assert.deepEqual(delivery, { sent: 1, failedUserIds: ["closed-dm"] })
    const content = json(sent[0]!.message)
    assert.match(content, /PŘIPOMÍNKA PŘIHLÁŠKY/)
    assert.match(content, /Připomínku poslalo velení z Logi\./)
    assert.match(content, /Klan Vlci/)
})

test("unconfirmed players get the attendance reminder with their place, leader and buttons", async () => {
    const { sent, send } = recorder()
    const delivery = await deliverManualReminder({
        payload,
        request: {
            id: "request-2",
            eventId: "event-1",
            guildId: "guild-1",
            audience: "unconfirmed",
            recipientIds: ["slot-1", "reserve-1"],
        },
        send,
        now: Date.parse("2099-01-01T11:00:00.000Z"),
    })
    assert.deepEqual(delivery, { sent: 2, failedUserIds: [] })
    const first = json(sent[0]!.message)
    assert.match(first, /Dnes hraješ VLK vs ROG/)
    assert.match(first, /\*\*Able · Medic\*\* · velitel čety Rex\\\\_CZ/)
    assert.match(first, /Připomínku poslalo velení z Logi\./)
    for (const id of [
        "attendance-confirm:event-1",
        "attendance-late:event-1",
        "attendance-decline:event-1",
    ])
        assert.match(first, new RegExp(id))
    assert.match(
        json(sent[1]!.message),
        /\*\*Záloha\*\* · když se uvolní místo/
    )
})

test("nothing is sent for an unknown match or an empty recipient list", async () => {
    const { sent, send } = recorder()
    assert.deepEqual(
        await deliverManualReminder({
            payload,
            request: {
                id: "request-3",
                eventId: "missing",
                guildId: "guild-1",
                audience: "unanswered",
                recipientIds: ["member-1"],
            },
            send,
        }),
        { sent: 0, failedUserIds: [] }
    )
    assert.deepEqual(
        await deliverManualReminder({
            payload,
            request: {
                id: "request-4",
                eventId: "event-1",
                guildId: "guild-1",
                audience: "unconfirmed",
                recipientIds: [],
            },
            send,
        }),
        { sent: 0, failedUserIds: [] }
    )
    assert.equal(sent.length, 0)
})
