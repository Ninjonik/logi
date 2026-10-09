import assert from "node:assert/strict"
import test from "node:test"

import {
    workspaceAdminActions,
    type WorkspaceAdminActionPorts,
} from "./workspace-admin-actions-route"

const origin = "https://logi.test"
type Call = { name: string; args: unknown[] }

function setup(overrides: Partial<WorkspaceAdminActionPorts> = {}) {
    const calls: Call[] = []
    const handlers = workspaceAdminActions({
        origin,
        authorize: async () => "111111111111111111",
        setEnabledGames: async (...args) => {
            calls.push({ name: "setEnabledGames", args })
        },
        resyncDashboardAdmins: async (...args) => {
            calls.push({ name: "resyncDashboardAdmins", args })
        },
        revalidate: (...args) => {
            calls.push({ name: "revalidate", args })
        },
        ...overrides,
    })
    return { calls, handlers }
}

const request = (body: unknown, from = origin) =>
    new Request("https://internal.local/api/servers/s1/enabled-games", {
        method: "POST",
        headers: { origin: from, "content-type": "application/json" },
        body: JSON.stringify(body),
    })

test("enabled games are saved as the signed-in administrator, not a body user", async () => {
    const { calls, handlers } = setup()
    const response = await handlers.setEnabledGames(
        request({ enabledGames: ["wardogs", "wardogs", "hell_let_loose"] }),
        "s1"
    )
    assert.equal(response.status, 200)
    assert.deepEqual(calls[0], {
        name: "setEnabledGames",
        args: ["s1", "111111111111111111", ["wardogs", "hell_let_loose"]],
    })
    assert.deepEqual(calls[1], { name: "revalidate", args: ["s1"] })
})

test("a supplied user ID is rejected while opaque game IDs are accepted", async () => {
    const { calls, handlers } = setup()
    for (const body of [
        { enabledGames: ["wardogs"], userId: "222222222222222222" },
        {},
    ]) {
        const response = await handlers.setEnabledGames(request(body), "s1")
        assert.equal(response.status, 400)
    }
    const accepted = await handlers.setEnabledGames(
        request({ enabledGames: ["chess"] }),
        "s1"
    )
    assert.equal(accepted.status, 200)
    assert.deepEqual(calls[0], {
        name: "setEnabledGames",
        args: ["s1", "111111111111111111", ["chess"]],
    })
})

test("other origins and non-administrators cannot write", async () => {
    const foreign = setup()
    assert.equal(
        (
            await foreign.handlers.setEnabledGames(
                request({ enabledGames: [] }, "https://evil.test"),
                "s1"
            )
        ).status,
        403
    )
    assert.equal(
        (
            await foreign.handlers.resyncDashboardAdmins(
                request({}, "https://evil.test"),
                "s1"
            )
        ).status,
        403
    )
    const member = setup({ authorize: async () => null })
    assert.equal(
        (await member.handlers.resyncDashboardAdmins(request({}), "s1")).status,
        403
    )
    assert.equal(foreign.calls.length + member.calls.length, 0)
})

test("dashboard admin resync runs as the signed-in administrator", async () => {
    const { calls, handlers } = setup()
    const response = await handlers.resyncDashboardAdmins(request({}), "s1")
    assert.equal(response.status, 200)
    assert.deepEqual(calls[0], {
        name: "resyncDashboardAdmins",
        args: ["s1", "111111111111111111"],
    })
})
