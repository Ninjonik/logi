import assert from "node:assert/strict"
import test from "node:test"

import {
    eventExcusesHandler,
    type EventExcusesPorts,
    type EventExcusesResult,
} from "./event-excuses-route"

const origin = "https://logi.invalid"
const params = { serverId: "guilds:one", eventId: "events:one" }
const body = { excuses: [{ userId: "123456789", excused: true }] }

function fixture(
    result: EventExcusesResult | Error = { status: "saved" },
    admin = true
) {
    const calls: unknown[] = []
    const revalidated: unknown[] = []
    const ports: EventExcusesPorts = {
        origin,
        access: async (serverId) => {
            calls.push({ access: serverId })
            return admin
                ? { guildId: "910000000000000001", actorDiscordId: "7654321" }
                : null
        },
        save: async (input) => {
            calls.push(input)
            if (result instanceof Error) throw result
            return result
        },
        revalidate: (...args) => revalidated.push(args),
    }
    const request = (
        value: unknown = body,
        headers: HeadersInit = { origin }
    ) =>
        new Request(
            "http://127.0.0.1:3000/api/servers/guilds:one/events/events:one/excuses",
            {
                method: "POST",
                headers: { "Content-Type": "application/json", ...headers },
                body: typeof value === "string" ? value : JSON.stringify(value),
            }
        )
    return { handler: eventExcusesHandler(ports), request, calls, revalidated }
}

test("a clan admin excuses roster players", async () => {
    const { handler, request, calls, revalidated } = fixture()
    const response = await handler(request(), params)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
    assert.deepEqual(calls[1], {
        guildId: "910000000000000001",
        eventId: "events:one",
        actorId: "7654321",
        excuses: body.excuses,
    })
    assert.deepEqual(revalidated, [["guilds:one", "events:one"]])
})

test("foreign origins, non-admins and loose bodies are refused", async () => {
    const foreign = fixture()
    assert.equal(
        (await foreign.handler(foreign.request(body, { origin: "x" }), params))
            .status,
        403
    )
    assert.deepEqual(foreign.calls, [])
    const member = fixture(undefined, false)
    assert.equal((await member.handler(member.request(), params)).status, 403)
    for (const value of [
        { excuses: [] },
        { excuses: [{ userId: "abc", excused: true }] },
        { excuses: body.excuses, extra: 1 },
        { excuses: [{ userId: "123456789", excused: true, reason: "x" }] },
    ]) {
        const loose = fixture()
        assert.equal(
            (await loose.handler(loose.request(value), params)).status,
            400
        )
    }
})

test("closed, unknown and unavailable matches map to HTTP errors", async () => {
    const closed = fixture({ status: "closed" })
    assert.equal((await closed.handler(closed.request(), params)).status, 409)
    const missing = fixture({ status: "not_found" })
    assert.equal((await missing.handler(missing.request(), params)).status, 404)
    const invalid = fixture({ status: "invalid" })
    assert.equal((await invalid.handler(invalid.request(), params)).status, 400)
    const broken = fixture(new Error("down"))
    assert.equal((await broken.handler(broken.request(), params)).status, 503)
})
