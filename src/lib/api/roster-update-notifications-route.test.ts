import assert from "node:assert/strict"
import test from "node:test"

import type { Roster } from "@/types/domain"

import {
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

const grant = {
    roster: saved,
    guildId: "123456789012345678",
    actorId: "223456789012345678",
}

function setup(
    access: Awaited<ReturnType<RosterUpdateNotificationPorts["access"]>> = grant
) {
    const calls: Parameters<RosterUpdateNotificationPorts["notify"]>[0][] = []
    const statusCalls: Array<[string, string]> = []
    const routes = rosterUpdateNotificationsHandler({
        origin,
        access: async () => access,
        notify: async (input) => {
            calls.push(input)
            return { ok: true, hasChanges: true, requestId: "req1" }
        },
        status: async (guildId, requestId) => {
            statusCalls.push([guildId, requestId])
            return requestId === "req1"
                ? { status: "sent", dmSent: 2, dmFailedUserIds: ["member-2"] }
                : null
        },
    })
    return { handler: routes.POST, get: routes.GET, calls, statusCalls }
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

test("an unknown roster or an invalid body is refused", async () => {
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
        (await handler(request({ notifyPlayers: "yes" }), params)).status,
        400
    )
    assert.equal(calls.length, 0)
})

test("the baseline is the server's: a roster the browser sends is ignored (D5-B04)", async () => {
    const { handler, calls } = setup()
    // A current dashboard sends only the choices.
    assert.equal(
        (await handler(request({ notifyPlayers: true }), params)).status,
        200
    )
    // An older dashboard's previous roster, even of another match or naming
    // a stranger, never reaches the request.
    assert.equal(
        (
            await handler(
                request({
                    previousRoster: {
                        eventId: "event-2",
                        squads: [
                            {
                                name: "Able",
                                players: [{ id: "stranger", roleName: "x" }],
                            },
                        ],
                    },
                }),
                params
            )
        ).status,
        200
    )
    assert.equal(calls.length, 2)
    for (const call of calls) {
        assert.equal(call.roster, saved)
        assert.ok(!("previousRoster" in call))
        assert.doesNotMatch(JSON.stringify(call), /stranger|event-2/)
    }
})

test("only a published roster sends notifications", async () => {
    const { handler, calls } = setup({
        ...grant,
        roster: { ...saved, published: false },
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
    assert.equal(calls[0].mentionPlayers, false)
    // The bot sends; the request carries the clan and the admin from the session.
    assert.equal(calls[0].guildId, grant.guildId)
    assert.equal(calls[0].actorId, grant.actorId)
    assert.deepEqual(await response.json(), {
        ok: true,
        hasChanges: true,
        requestId: "req1",
    })
})

test("a re-publish can ask the bot to mention the rostered players again", async () => {
    const { handler, calls } = setup()
    await handler(
        request({ previousRoster: previous, mentionPlayers: true }),
        params
    )
    assert.equal(calls[0].mentionPlayers, true)
})

test("the publish dialog reads how the change DMs went, for its own clan only", async () => {
    const { get, statusCalls } = setup()
    const url =
        "https://logi.test/api/servers/s1/rosters/roster-1/update-notifications"
    const ok = await get(new Request(`${url}?requestId=req1`), params)
    assert.equal(ok.status, 200)
    assert.deepEqual(await ok.json(), {
        status: "sent",
        dmSent: 2,
        dmFailedUserIds: ["member-2"],
    })
    assert.deepEqual(statusCalls, [[grant.guildId, "req1"]])
    assert.equal(
        (await get(new Request(`${url}?requestId=other`), params)).status,
        404
    )
    assert.equal(
        (await get(new Request(`${url}?requestId=bad id`), params)).status,
        400
    )
    const outsider = setup(null)
    assert.equal(
        (await outsider.get(new Request(`${url}?requestId=req1`), params))
            .status,
        403
    )
})
