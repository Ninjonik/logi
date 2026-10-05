import assert from "node:assert/strict"
import test from "node:test"

import type { Roster } from "@/types/domain"

import {
    previousRosterForSummary,
    rosterUpdateNotificationsHandler,
    type RosterUpdateNotificationPorts,
} from "./roster-update-notifications-route"

const origin = "https://logi.test"

const saved: Roster = {
    id: "roster-1",
    eventId: "event-1",
    guildId: "guild-1",
    published: true,
    reservePlayerIds: [],
    notAttendingPlayerIds: [],
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-05T10:00:00.000Z",
    squads: [
        {
            name: "Able",
            group: "Infantry",
            order: 1,
            color: "#16a34a",
            players: [{ id: "member-1", ack: true, roleName: "Officer" }],
        },
    ],
}

const memberIds = new Set(["member-1", "member-2"])

function setup(
    access: Awaited<ReturnType<RosterUpdateNotificationPorts["access"]>> = {
        roster: saved,
        memberIds,
    }
) {
    const calls: Parameters<RosterUpdateNotificationPorts["notify"]>[0][] = []
    const handler = rosterUpdateNotificationsHandler({
        origin,
        access: async () => access,
        notify: async (input) => {
            calls.push(input)
            return { ok: true, hasChanges: true }
        },
    })
    return { handler, calls }
}

function request(body: unknown, requestOrigin = origin) {
    return new Request(
        "https://logi.test/api/servers/s1/rosters/roster-1/update-notifications",
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
                origin: requestOrigin,
            },
            body: JSON.stringify(body),
        }
    )
}

const params = { serverId: "s1", rosterId: "roster-1" }

const previous = {
    eventId: "event-1",
    squads: [
        {
            name: "Able",
            players: [{ id: "member-2", roleName: "Officer" }],
        },
    ],
}

test("a foreign origin or a missing clan admin is refused before anything is sent", async () => {
    const foreign = setup()
    assert.equal(
        (
            await foreign.handler(
                request({ previousRoster: previous }, "https://evil.test"),
                params
            )
        ).status,
        403
    )
    assert.equal(foreign.calls.length, 0)

    const outsider = setup(null)
    assert.equal(
        (await outsider.handler(request({ previousRoster: previous }), params))
            .status,
        403
    )
    assert.equal(outsider.calls.length, 0)
})

test("an unknown roster, an invalid body or another match's roster is refused", async () => {
    const missing = setup("not_found")
    assert.equal(
        (await missing.handler(request({ previousRoster: previous }), params))
            .status,
        404
    )

    const { handler, calls } = setup()
    assert.equal(
        (await handler(request({ previousRoster: previous, extra: 1 }), params))
            .status,
        400
    )
    assert.equal(
        (
            await handler(
                request({
                    previousRoster: { ...previous, eventId: "event-2" },
                }),
                params
            )
        ).status,
        400
    )
    assert.equal(calls.length, 0)
})

test("only a published roster sends notifications", async () => {
    const { handler, calls } = setup({
        roster: { ...saved, published: false },
        memberIds,
    })
    assert.equal(
        (await handler(request({ previousRoster: previous }), params)).status,
        409
    )
    assert.equal(calls.length, 0)
})

test("the saved roster is used, never the one the request sends", async () => {
    const { handler, calls } = setup()
    const response = await handler(
        request({
            previousRoster: previous,
            nextRoster: {
                ...saved,
                squads: [
                    {
                        name: "Fake",
                        players: [{ id: "stranger", ack: true }],
                    },
                ],
            },
            postAnnouncement: true,
        }),
        params
    )
    assert.equal(response.status, 200)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].roster, saved)
    assert.equal(calls[0].postAnnouncement, true)
    assert.equal(calls[0].notifyPlayers, true)
})

test("players who are not clan members are dropped from the previous roster", () => {
    const shaped = previousRosterForSummary(
        saved,
        {
            eventId: "event-1",
            squads: [
                {
                    name: "Able",
                    players: [
                        { id: "member-2", roleName: "Medic" },
                        { id: "stranger", roleName: "Officer" },
                        { id: null },
                    ],
                },
            ],
        },
        memberIds
    )
    assert.deepEqual(
        shaped.squads[0].players.map((player) => player.id),
        ["member-2", undefined, undefined]
    )
    assert.equal(shaped.id, saved.id)
    assert.equal(shaped.eventId, saved.eventId)
})
