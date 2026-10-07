import assert from "node:assert/strict"
import test from "node:test"

import { updateBotState } from "../../../convex/platformSettings"
import { invoke, testContext } from "./testing/database"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET

test("the bot's status state is stored only when it changed", async () => {
    const ctx = testContext()
    const states = [
        { name: "Dashboard", online: true, since: "2026-10-07T08:00:00.000Z" },
        { name: "Convex", online: true, since: "2026-10-07T08:00:00.000Z" },
    ]
    ctx.db.seed("platformSettings", {
        _id: "platformSettings:1",
        workspaceGuildId: "100000000000000001",
        statusChannelId: "100000000000000002",
        statusMessageId: "100000000000000003",
        statusUpdatesThreadId: "100000000000000004",
        serviceStates: states,
        updatedAt: "2026-10-07T08:00:00.000Z",
    })
    const patches: unknown[] = []
    const patch = ctx.db.patch.bind(ctx.db)
    ctx.db.patch = async (id, value) => {
        patches.push(value)
        return await patch(id, value)
    }
    const state = {
        secret,
        statusMessageId: "100000000000000003",
        statusUpdatesThreadId: "100000000000000004",
        serviceStates: states.map((entry) => ({ ...entry })),
    }
    await invoke(updateBotState, ctx, state)
    assert.equal(patches.length, 0)
    await invoke(updateBotState, ctx, {
        ...state,
        serviceStates: [
            states[0],
            { ...states[1], online: false, since: "2026-10-07T12:00:00.000Z" },
        ],
    })
    assert.equal(patches.length, 1)
    assert.equal(
        ctx.db.tables.platformSettings[0].serviceStates[1].online,
        false
    )
    await invoke(updateBotState, ctx, {
        ...state,
        statusMessageId: "100000000000000005",
    })
    assert.equal(patches.length, 2)
})
