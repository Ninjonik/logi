import assert from "node:assert/strict"
import test from "node:test"

import type { DiscordConfig, EventRecord, Roster } from "../types"
import { buildRosterAssignmentReply } from "./roster-assignment"

const config: DiscordConfig = {
    id: "config-1",
    guildId: "guild-1",
    timezone: "Europe/Prague",
    defaultLanguage: "cs",
    calendarCategories: [],
    meetingChannelId: "meeting-channel",
    updatedAt: "2026-10-01T10:00:00.000Z",
}

const event: EventRecord = {
    id: "event-1",
    guildId: "guild-1",
    kind: "match",
    name: "VLK vs ROG",
    requiredRoleIds: [],
    rewardRoleIds: [],
    server: "VLK Scrim",
    serverPassword: "synthetic-private",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    gameEnd: "2026-10-11T20:00:00.000Z",
    pingClan: false,
    createForumChannel: false,
    status: "starting",
    statusUpdatedAt: "2026-10-11T16:00:00.000Z",
    attendanceReminderLog: [],
    signUps: [],
    participants: [],
    updatedAt: "2026-10-11T16:00:00.000Z",
}

const roster: Roster = {
    id: "roster-1",
    eventId: "event-1",
    published: true,
    reservePlayerIds: ["reserve-1"],
    reserveAttendances: [{ userId: "reserve-1", ack: true }],
    updatedAt: "2026-10-11T15:00:00.000Z",
    squads: [
        {
            name: "Able",
            group: "Infantry",
            color: "#16a34a",
            order: 1,
            players: [
                { id: "leader-1", ack: true, roleName: "Officer" },
                {
                    id: "player-1",
                    ack: false,
                    roleName: "Medic",
                    note: "Bring *smokes*",
                },
            ],
        },
    ],
}

function render(userId: string, patch: Partial<EventRecord> = {}) {
    const reply = buildRosterAssignmentReply({
        config,
        event: { ...event, ...patch },
        roster,
        userId,
    })
    return {
        reply,
        embed: reply.embeds?.[0]?.toJSON(),
        buttons: (reply.components ?? []).flatMap(
            (row) => row.toJSON().components
        ),
    }
}

test("my assignment shows squad, role, leader, meeting, server and password privately", () => {
    const { reply, embed, buttons } = render("player-1")

    assert.equal(embed?.title, "Able · Medic")
    assert.equal(
        embed?.description,
        [
            "Velitel čety: <@leader-1> · sraz <t:1791739800:t> (<t:1791739800:R>) v kanálu <#meeting-channel>",
            "Bring \\*smokes\\*",
            "Server: VLK Scrim · heslo `synthetic-private`",
        ].join("\n")
    )
    assert.equal(embed?.footer?.text, "Heslo vidí jen hráči na soupisce.")
    assert.equal(embed?.color, 0xe8a33d)
    assert.deepEqual(reply.allowedMentions, { parse: [] })
    assert.deepEqual(
        buttons.map((button) =>
            "custom_id" in button ? button.custom_id : undefined
        ),
        ["attendance:event-1:ack", "attendance-late:event-1"]
    )
    assert.deepEqual(
        buttons.map((button) => ("label" in button ? button.label : "")),
        ["Potvrdím účast", "Přijdu později"]
    )
})

test("the squad leader sees no leader line and an acknowledged player gets no confirm button", () => {
    const { embed, buttons } = render("leader-1")

    assert.equal(embed?.title, "Able · Officer")
    assert.doesNotMatch(embed?.description ?? "", /Velitel čety/)
    assert.match(embed?.description ?? "", /^Sraz <t:/)
    assert.deepEqual(
        buttons.map((button) =>
            "custom_id" in button ? button.custom_id : undefined
        ),
        ["attendance-late:event-1"]
    )
})

test("reserves see the server and password with the reserve notice", () => {
    const { embed } = render("reserve-1")

    assert.equal(embed?.title, "Záloha")
    assert.match(embed?.description ?? "", /^Pro tuto akci jste náhradník\./)
    assert.match(embed?.description ?? "", /heslo `synthetic-private`/)
})

test("players off the roster or before publication never see the password", () => {
    const outsider = render("someone-else").reply
    assert.equal(outsider.embeds, undefined)
    assert.equal(outsider.content, "Zatím nemáte zařazení do soupisky.")

    const draft = buildRosterAssignmentReply({
        config,
        event,
        roster: { ...roster, published: false },
        userId: "player-1",
    })
    assert.equal(draft.embeds, undefined)
    assert.equal(
        draft.content,
        "Soupiska pro tuto akci ještě není publikovaná."
    )
    assert.doesNotMatch(JSON.stringify([outsider, draft]), /synthetic-private/)
})

test("attendance buttons appear only while the event is starting", () => {
    const { buttons, embed } = render("player-1", {
        status: "closed",
        serverPassword: "with`tick",
    })

    assert.deepEqual(buttons, [])
    assert.match(embed?.description ?? "", /heslo `` with`tick ``/)
})

test("the private reply uses the event category colour like the event card", () => {
    const colour = (categoryColor?: string | null) =>
        buildRosterAssignmentReply({
            config,
            event,
            roster,
            userId: "player-1",
            categoryColor,
        }).embeds?.[0]?.toJSON().color
    assert.equal(colour("#dc2626"), 0xdc2626)
    assert.equal(colour(null), 0xe8a33d)
    assert.equal(colour("not a colour"), 0xe8a33d)
})
