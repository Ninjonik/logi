import { boardEvent, boardPayload } from "../events/board-example.fixture"
import { ConvexReactClient } from "convex/react"
import { syncCalendarPanel } from "./panels"
import type { Client } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

test("unreadable calendar policy cannot fall back to publishing in the legacy channel", async (t) => {
    const error = new Error("policy backend unavailable")
    t.mock.method(ConvexReactClient.prototype, "query", async () => {
        throw error
    })
    let discordReads = 0
    const client = {
        guilds: {
            fetch: async () => {
                discordReads++
                throw new Error("unexpected Discord call")
            },
        },
    } as unknown as Client
    await assert.rejects(
        syncCalendarPanel(client, boardPayload(boardEvent())),
        error
    )
    assert.equal(discordReads, 0)
})
