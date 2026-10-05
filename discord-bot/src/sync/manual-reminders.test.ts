import assert from "node:assert/strict"
import test from "node:test"

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
            players: [{ id: "slot-1", ack: false, roleName: "Medic" }],
        },
    ],
} as unknown as Roster

const payload = {
    config: {
        id: "config-1",
        guildId: "guild-1",
        timezone: "Europe/Prague",
        defaultLanguage: "en",
        calendarCategories: [],
        updatedAt: "2026-07-29T10:00:00.000Z",
    },
    groups: [],
    guild: { eventCategories: [] },
    rosters: [roster],
    userDisplayNames: {},
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

test("unanswered members get the sign-up reminder and failed DMs are not counted", async () => {
    const { sent, send } = recorder(["closed-dm"])
    const count = await deliverManualReminder({
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
    assert.equal(count, 1)
    assert.deepEqual(
        sent.map((entry) => entry.userId),
        ["member-1", "closed-dm"]
    )
    const message = sent[0]!.message as { components?: unknown[] }
    assert.ok(message.components?.length)
})

test("unconfirmed players get the attendance reminder with their place and buttons", async () => {
    const { sent, send } = recorder()
    const count = await deliverManualReminder({
        payload,
        request: {
            id: "request-2",
            eventId: "event-1",
            guildId: "guild-1",
            audience: "unconfirmed",
            recipientIds: ["slot-1", "reserve-1"],
        },
        send,
    })
    assert.equal(count, 2)
    const first = sent[0]!.message as {
        embeds: Array<{ toJSON(): { description?: string } }>
        components: Array<{
            toJSON(): { components: Array<{ custom_id?: string }> }
        }>
    }
    assert.match(first.embeds[0]!.toJSON().description ?? "", /Able · Medic/)
    assert.deepEqual(
        first.components[0]!.toJSON().components.map((c) => c.custom_id),
        [
            "attendance:event-1:ack",
            "attendance-late:event-1",
            "attendance-decline:event-1",
        ]
    )
})

test("nothing is sent for an unknown match or an empty recipient list", async () => {
    const { sent, send } = recorder()
    assert.equal(
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
        0
    )
    assert.equal(sent.length, 0)
})
