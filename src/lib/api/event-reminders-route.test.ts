import assert from "node:assert/strict"
import test from "node:test"

import {
    eventRemindersHandler,
    type EventReminderPorts,
    type EventReminderResult,
} from "./event-reminders-route"

const origin = "https://logi.invalid"
const params = { serverId: "guilds:one", eventId: "events:one" }

function fixture(
    result: EventReminderResult | Error = { status: "queued", queued: 12 },
    admin = true
) {
    const calls: unknown[] = []
    const ports: EventReminderPorts = {
        origin,
        access: async (serverId) => {
            calls.push({ access: serverId })
            return admin
                ? { guildId: "910000000000000001", actorDiscordId: "1234567" }
                : null
        },
        request: async (input) => {
            calls.push(input)
            if (result instanceof Error) throw result
            return result
        },
        now: () => Date.parse("2026-10-10T18:00:00.000Z"),
    }
    const request = (
        body: unknown = { audience: "unanswered" },
        headers: HeadersInit = { origin }
    ) =>
        new Request(
            "http://127.0.0.1:3000/api/servers/guilds:one/events/events:one/reminders",
            {
                method: "POST",
                headers: { "Content-Type": "application/json", ...headers },
                body: typeof body === "string" ? body : JSON.stringify(body),
            }
        )
    return { handler: eventRemindersHandler(ports), request, calls }
}

test("a clan admin queues reminders and gets the recipient count", async () => {
    const { handler, request, calls } = fixture()
    const response = await handler(request(), params)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("Cache-Control"), "no-store")
    assert.deepEqual(await response.json(), { queued: 12 })
    assert.deepEqual(calls, [
        { access: "guilds:one" },
        {
            guildId: "910000000000000001",
            eventId: "events:one",
            audience: "unanswered",
            requestedBy: "1234567",
        },
    ])
})

test("foreign origins and non-admins are refused before the body is read", async () => {
    const foreign = fixture()
    const response = await foreign.handler(
        foreign.request({ audience: "unanswered" }, { origin: "https://x.y" }),
        params
    )
    assert.equal(response.status, 403)
    assert.deepEqual(foreign.calls, [])

    const member = fixture(undefined, false)
    const denied = await member.handler(member.request(), params)
    assert.equal(denied.status, 403)
    assert.deepEqual(member.calls, [{ access: "guilds:one" }])
})

test("the body is strict", async () => {
    for (const body of [
        { audience: "everyone" },
        { audience: "unanswered", userIds: ["1"] },
        {},
        "not json",
    ]) {
        const { handler, request, calls } = fixture()
        const response = await handler(request(body), params)
        assert.equal(response.status, 400)
        assert.equal(calls.length, 1)
    }
})

test("cool-down, unavailable audiences and unknown matches map to HTTP errors", async () => {
    const limited = fixture({
        status: "rate_limited",
        retryAt: "2026-10-10T18:20:00.000Z",
    })
    const limitedResponse = await limited.handler(limited.request(), params)
    assert.equal(limitedResponse.status, 429)
    assert.equal(limitedResponse.headers.get("Retry-After"), "1200")
    assert.deepEqual(await limitedResponse.json(), {
        error: "rate_limited",
        retryAt: "2026-10-10T18:20:00.000Z",
    })

    const closed = fixture({ status: "unavailable", reason: "signups_closed" })
    const closedResponse = await closed.handler(closed.request(), params)
    assert.equal(closedResponse.status, 409)
    assert.deepEqual(await closedResponse.json(), {
        error: "unavailable",
        reason: "signups_closed",
    })

    const missing = fixture({ status: "not_found" })
    assert.equal((await missing.handler(missing.request(), params)).status, 404)

    const broken = fixture(new Error("Convex down"))
    assert.equal((await broken.handler(broken.request(), params)).status, 503)
})
