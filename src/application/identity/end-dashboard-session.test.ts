import { endDashboardSession } from "./end-dashboard-session"
import assert from "node:assert/strict"
import { test } from "node:test"

test("logout revokes persistence and Steam challenges before removing the cookie", async () => {
    const calls: unknown[] = []
    await endDashboardSession(
        {
            session: async () => ({ sub: "subject" }),
            revoke: async (_, global) => {
                calls.push(["revoke", global])
            },
            cancelSteam: async (token, subject) => {
                calls.push(["steam", token, subject])
            },
            clearCookie: () => {
                calls.push("clear")
            },
        },
        "saved-token",
        true
    )
    assert.deepEqual(calls, [
        ["revoke", true],
        ["steam", "saved-token", "subject"],
        "clear",
    ])
})
test("failed revocation cancels Steam but retains the cookie for a real retry", async () => {
    const calls: string[] = []
    await assert.rejects(
        endDashboardSession(
            {
                session: async () => ({ sub: "subject" }),
                revoke: async () => {
                    throw new Error("unavailable")
                },
                cancelSteam: async () => {
                    calls.push("steam")
                },
                clearCookie: () => {
                    calls.push("clear")
                },
            },
            "saved-token",
            false
        ),
        /unavailable/
    )
    assert.deepEqual(calls, ["steam"])
})
test("Steam cancellation failure cannot undo durable logout", async () => {
    let cleared = false
    await endDashboardSession(
        {
            session: async () => ({ sub: "subject" }),
            revoke: async () => {},
            cancelSteam: async () => {
                throw new Error("Steam unavailable")
            },
            clearCookie: () => {
                cleared = true
            },
        },
        "token",
        false
    )
    assert.equal(cleared, true)
})
