import assert from "node:assert/strict"
import test from "node:test"

import { MessageFlags } from "discord.js"

import {
    buildFullRosterView,
    buildRosterAssignmentReply,
    buildSquadView,
} from "./roster-assignment"
import type { DiscordConfig, EventRecord, Roster } from "../types"
import { interactionReplyPayload } from "../ui/message-kit"

const config: DiscordConfig = {
    id: "config-1",
    guildId: "guild-1",
    timezone: "Europe/Prague",
    defaultLanguage: "cs",
    calendarCategories: [],
    meetingChannelId: "200000000000000001",
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

const leader = "100000000000000001"
const player = "100000000000000002"
const reserve = "100000000000000003"

const roster: Roster = {
    id: "roster-1",
    eventId: "event-1",
    published: true,
    reservePlayerIds: [reserve],
    reserveAttendances: [{ userId: reserve, ack: true }],
    updatedAt: "2026-10-11T15:00:00.000Z",
    squads: [
        {
            name: "Able",
            group: "Infantry",
            color: "#16a34a",
            order: 1,
            players: [
                { id: leader, ack: true, roleName: "Officer" },
                {
                    id: player,
                    ack: false,
                    roleName: "Medic",
                    note: "Bring *smokes*",
                },
                { ack: false, roleName: "Rifleman" },
            ],
        },
    ],
}

const names = { [leader]: "Rex_CZ", [player]: "Medvěd", [reserve]: "Fík" }
const duringMeeting = Date.parse("2026-10-11T17:40:00.000Z")

function render(
    userId: string,
    patch: Partial<EventRecord> = {},
    now = duringMeeting
) {
    const reply = buildRosterAssignmentReply({
        config,
        event: { ...event, ...patch },
        roster,
        userId,
        names,
        now,
    })
    const json = JSON.stringify(reply.components.map((item) => item.toJSON()))
    const buttons = reply.components
        .flatMap((item) => item.toJSON().components)
        .flatMap((child) =>
            "components" in child && child.type === 1 ? child.components : []
        )
    return { reply, json, buttons }
}

test("my assignment is a private card with squad, role, leader, note, server and password", () => {
    const { reply, json, buttons } = render(player)
    assert.equal(
        reply.flags,
        MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    )
    assert.match(json, /MOJE ZAŘAZENÍ · VLK VS ROG/)
    assert.match(json, /### \+ Able · Medic/)
    assert.match(
        json,
        /Velitel čety Rex\\\\_CZ · sraz běží v kanálu <#200000000000000001>/
    )
    assert.match(json, /> Velení: Bring \\\\\*smokes\\\\\*/)
    assert.match(json, /Server \*\*VLK Scrim\*\* · heslo `synthetic-private`/)
    assert.match(json, /Heslo vidí jen hráči na soupisce\. Nesdílej ho dál\./)
    assert.deepEqual(reply.allowedMentions, { parse: [] })
    assert.deepEqual(
        buttons.map((button) =>
            "custom_id" in button ? button.custom_id : ""
        ),
        // The reply can arrive in a DM, so its buttons name the server.
        [
            "attendance-confirm:event-1:guild-1",
            "attendance-late:event-1:guild-1",
        ]
    )
})

test("the squad leader sees no leader line and an acknowledged player gets no confirm button", () => {
    const { json, buttons } = render(leader)
    assert.match(json, /### ≡ Able · Officer/)
    assert.doesNotMatch(json, /Velitel čety/)
    assert.deepEqual(
        buttons.map((button) =>
            "custom_id" in button ? button.custom_id : ""
        ),
        ["attendance-late:event-1:guild-1"]
    )
})

test("before the meeting only Přijdu později is offered; after the start nothing", () => {
    const early = render(player, {}, Date.parse("2026-10-11T12:00:00.000Z"))
    assert.deepEqual(
        early.buttons.map((button) => ("label" in button ? button.label : "")),
        ["Přijdu později"]
    )
    const started = render(player, {}, Date.parse("2026-10-11T18:05:00.000Z"))
    assert.deepEqual(started.buttons, [])
})

test("reserves see the reserve card with server and password", () => {
    const { json } = render(reserve)
    assert.match(json, /### Záloha/)
    assert.match(
        json,
        /Když se uvolní místo, velení tě přesune a pošle ti DM\./
    )
    assert.match(json, /heslo `synthetic-private`/)
})

test("players off the roster or before publication never see the password", () => {
    const outsider = render("100000000000000009").json
    assert.match(outsider, /Na soupisce nejsi/)
    const draft = buildRosterAssignmentReply({
        config,
        event,
        roster: { ...roster, published: false },
        userId: player,
    })
    const draftJson = JSON.stringify(
        draft.components.map((item) => item.toJSON())
    )
    assert.match(draftJson, /Soupiska ještě není zveřejněná/)
    assert.doesNotMatch(outsider + draftJson, /synthetic-private/)
})

test("passwords with backticks stay inline code", () => {
    const { json } = render(player, { serverPassword: "with`tick" })
    assert.match(json, /heslo `` with`tick ``/)
})

test("the squad view lists the slots with ticks and a select of every squad", () => {
    const view = buildSquadView({
        context: { config, event, roster },
        names,
        now: duringMeeting,
    })
    const payload = interactionReplyPayload(view, { language: "cs" })
    const json = JSON.stringify(payload.components.map((item) => item.toJSON()))
    assert.match(json, /### Able · Infantry · 2 z 3/)
    assert.match(json, /Officer · \*\*Rex\\\\_CZ\*\* ✓ potvrzeno/)
    assert.match(json, /Medic · \*\*Medvěd\*\* ⏳ zatím ne/)
    assert.match(json, /Rifleman · volné místo/)
    assert.match(json, /roster-squads-select:event-1/)
    assert.equal(payload.flags & MessageFlags.Ephemeral, MessageFlags.Ephemeral)
})

test("the whole roster is a private paged reply", () => {
    const view = buildFullRosterView({
        context: { config, event, roster },
        page: 1,
        names,
    })
    assert.equal(view.ephemeral, true)
    assert.equal(view.header?.title, "Celá soupiska")
})
