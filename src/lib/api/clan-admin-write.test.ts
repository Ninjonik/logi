import assert from "node:assert/strict"
import test from "node:test"

import { createClanAdminWriteGuard } from "./clan-admin-write"

const origin = "https://logi.example"
const request = (headers: Record<string, string>) =>
    new Request("http://internal/api/servers/s1/squad-presets/p1", {
        method: "DELETE",
        headers,
    })

test("a clan admin on the dashboard origin may write", async () => {
    const denied = createClanAdminWriteGuard({
        origin,
        canAdminServer: async () => true,
    })
    assert.equal(await denied(request({ origin }), "s1"), null)
})

test("another origin is refused without asking who the caller is", async () => {
    let asked = false
    const denied = createClanAdminWriteGuard({
        origin,
        canAdminServer: async () => {
            asked = true
            return true
        },
    })
    const response = await denied(
        request({ origin: "https://evil.example" }),
        "s1"
    )
    assert.equal(response?.status, 403)
    assert.equal(asked, false)
})

test("a member or a failed admin check is refused", async () => {
    const member = createClanAdminWriteGuard({
        origin,
        canAdminServer: async () => false,
    })
    assert.equal((await member(request({ origin }), "s1"))?.status, 403)
    const failing = createClanAdminWriteGuard({
        origin,
        canAdminServer: async () => {
            throw new Error("Convex unavailable")
        },
    })
    assert.equal((await failing(request({ origin }), "s1"))?.status, 403)
})
