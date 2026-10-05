import { MessageFlags } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

import { getAnnouncementPingRoleIds } from "../events/announcement"
import type { EventRecord, Roster, SyncPayload } from "../types"
import { buildEventMessageContent } from "./events"

const payload = { config: { clanRoleId: "clan-role" } } as SyncPayload

test("getAnnouncementPingRoleIds resolves the configured clan role", () => {
    const event = { pingClan: true, pingMode: "clan" } as EventRecord

    assert.deepEqual(getAnnouncementPingRoleIds(payload, event), ["clan-role"])
})

test("getAnnouncementPingRoleIds resolves and de-duplicates selected roles", () => {
    const event = {
        pingClan: false,
        pingMode: "roles",
        pingRoleIds: ["role-1", "role-1", " role-2 ", ""],
    } as EventRecord

    assert.deepEqual(getAnnouncementPingRoleIds(payload, event), [
        "role-1",
        "role-2",
    ])
})

test("getAnnouncementPingRoleIds pings nobody when the match pings nobody", () => {
    assert.deepEqual(
        getAnnouncementPingRoleIds(payload, {
            pingClan: true,
            pingMode: "none",
        } as EventRecord),
        []
    )
})

function createMessageFixture() {
    const event: EventRecord = {
        id: "event-1",
        guildId: "guild-1",
        kind: "match",
        name: "Native Match",
        map: "foy_warfare",
        side: "Allies",
        requiredRoleIds: [],
        rewardRoleIds: [],
        registrationEnd: "2026-07-29T12:30:00.000Z",
        meetingStart: "2026-07-29T13:00:00.000Z",
        gameStart: "2026-07-29T14:00:00.000Z",
        gameEnd: "2026-07-29T16:00:00.000Z",
        pingClan: true,
        createForumChannel: false,
        status: "starting",
        statusUpdatedAt: "2026-07-29T10:00:00.000Z",
        attendanceReminderLog: [],
        signUps: [],
        participants: [],
        updatedAt: "2026-07-29T10:00:00.000Z",
    }
    const roster: Roster = {
        id: "roster-1",
        eventId: event.id,
        published: true,
        reservePlayerIds: [],
        updatedAt: "2026-07-29T11:00:00.000Z",
        squads: [],
    }
    const fixturePayload = {
        config: {
            id: "config-1",
            guildId: "guild-1",
            timezone: "Europe/Prague",
            defaultLanguage: "en",
            calendarCategories: [],
            clanRoleId: "clan-role",
            updatedAt: "2026-07-29T10:00:00.000Z",
        },
    } as unknown as SyncPayload
    return { event, roster, payload: fixturePayload }
}

test("the information message is the roster card in both message formats", () => {
    const { event, roster, payload: fixture } = createMessageFixture()
    const legacy = buildEventMessageContent({
        payload: fixture,
        event,
        roster,
        userDisplayNames: {},
        legacyEmbeds: true,
    })
    assert.equal("embeds" in legacy ? legacy.embeds?.length : 0, 1)
    assert.deepEqual(legacy.components, [])

    const current = buildEventMessageContent({
        payload: fixture,
        event,
        roster,
        userDisplayNames: {},
        legacyEmbeds: false,
    })
    assert.equal(
        "flags" in current ? current.flags : undefined,
        MessageFlags.IsComponentsV2
    )
    const json = JSON.stringify(
        current.components.map((component) =>
            "toJSON" in component ? component.toJSON() : component
        )
    )
    assert.match(json, /roster-assignment:event-1/)
    // The roster card never carries the announcement's sign-up controls or pings.
    assert.doesNotMatch(json, /signup|attendees:|<@&/)
})
