import type { PlatformLinkPorts } from "../../application/identity/verify-platform-link"
import { platformLinksHandlers } from "./platform-links-route"
import assert from "node:assert/strict"
import test from "node:test"

const origin = "https://logi.test"
const unavailable = async () => {
    throw new Error("Unexpected port call")
}
test("Steam management is session-only and rejects cross-origin start/unlink before writes", async () => {
    let authenticated = false,
        writes = 0
    const handle = platformLinksHandlers({
        origin,
        actor: async () =>
            authenticated
                ? { discordUserId: "own", sessionHash: "session" }
                : null,
        list: async () => [],
        unlink: async () => {
            writes++
        },
        links: {
            create: async () => {
                writes++
            },
            randomState: () => "a".repeat(43),
            hash: (s) => s,
            now: () => 0,
            redirect: () => "https://steamcommunity.com/openid/login",
            claim: unavailable,
            verify: unavailable,
            complete: unavailable,
            fail: unavailable,
        },
    })
    const foreign = new Request(`${origin}/api/platform-links/steam/start`, {
        method: "POST",
        headers: {
            origin: "https://attacker.test",
            authorization: "Bearer service-key",
        },
        body: '{"locale":"cs"}',
    })
    assert.equal((await handle.start(foreign)).status, 401)
    authenticated = true
    assert.equal((await handle.start(foreign)).status, 403)
    assert.equal((await handle.unlink(foreign)).status, 403)
    assert.equal(writes, 0)
    const response = await handle.start(
        new Request(foreign.url, {
            method: "POST",
            headers: { origin },
            body: '{"locale":"cs"}',
        })
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal(writes, 1)
})
test("account read withholds unexpected fields and callback errors never echo assertions", async () => {
    const handle = platformLinksHandlers({
        origin,
        actor: async () => ({ discordUserId: "own", sessionHash: "session" }),
        list: async () => [{ secret: "private" }],
        unlink: async () => {},
        links: {} as PlatformLinkPorts,
    })
    assert.equal((await handle.status()).status, 503)
    const response = await handle.callback(
        new Request(
            `${origin}/api/platform-links/steam/callback?state=private-token&openid.sig=private-signature`
        )
    )
    assert.equal(response.status, 303)
    assert.equal(
        response.headers.get("location"),
        `${origin}/en/dashboard/settings/user?steam=failed`
    )
    assert.equal((await response.text()).includes("private"), false)
})
