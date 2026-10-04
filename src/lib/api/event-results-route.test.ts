import { eventResultsHandlers } from "./event-results-route"
import assert from "node:assert/strict"
import test from "node:test"
const origin = "https://logi.test"
test("review is session-only, same-origin and binds guild/game/actor from trusted context", async () => {
    let authorized = false,
        writes = 0
    const scope = {
        guildId: "guild",
        gameId: "wardogs" as const,
        actorId: "staff",
        eventId: "event",
    }
    const h = eventResultsHandlers({
        origin,
        authorize: async (_server, _event, game) =>
            authorized && game === "wardogs" ? scope : null,
        read: async () => ({
            current: null,
            history: [],
            sessions: [],
            hasLegacyImport: false,
        }),
        write: async (actual) => {
            writes++
            assert.deepEqual(actual, scope)
            return {}
        },
    })
    const req = (body: object, headers = { origin }) =>
        new Request(`${origin}/result?game=wardogs`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        })
    assert.equal(
        (
            await h.post(
                req({ action: "confirm", expectedRevision: 1 }, { origin }),
                "server",
                "event"
            )
        ).status,
        403
    )
    authorized = true
    assert.equal(
        (
            await h.post(
                req(
                    { action: "confirm", expectedRevision: 1 },
                    { origin: "https://attacker.test" }
                ),
                "server",
                "event"
            )
        ).status,
        403
    )
    assert.equal(
        (
            await h.post(
                req({
                    action: "confirm",
                    expectedRevision: 1,
                    actorId: "admin",
                }),
                "server",
                "event"
            )
        ).status,
        400
    )
    assert.equal(writes, 0)
    const get = await h.get(
        new Request(`${origin}/result?game=wardogs`),
        "server",
        "event"
    )
    assert.equal(get.status, 200)
    assert.equal(get.headers.get("cache-control"), "no-store")
    assert.equal(
        (
            await h.get(
                new Request(`${origin}/result?game=hell_let_loose`),
                "server",
                "event"
            )
        ).status,
        403
    )
})
test("revocation while reading withholds data", async () => {
    let allowed = true
    const h = eventResultsHandlers({
        origin,
        authorize: async () =>
            allowed
                ? {
                      guildId: "guild",
                      gameId: "wardogs",
                      eventId: "event",
                      actorId: "staff",
                  }
                : null,
        read: async () => {
            allowed = false
            return {
                current: null,
                history: [],
                sessions: [],
                hasLegacyImport: false,
            }
        },
        write: async () => ({}),
    })
    assert.equal(
        (
            await h.get(
                new Request(`${origin}/result?game=wardogs`),
                "server",
                "event"
            )
        ).status,
        403
    )
})
