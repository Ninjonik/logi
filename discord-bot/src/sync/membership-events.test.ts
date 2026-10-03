import { registerMembershipInvalidationEvents } from "./membership-events"
import { Client, Events, type Guild } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"
test("Gateway role/reconnect events invalidate the affected guild before requesting reconciliation", async () => {
    const client = new Client({ intents: [] }),
        calls: string[] = []
    client.guilds.cache.set("guild-a", { id: "guild-a", shardId: 0 } as Guild)
    client.guilds.cache.set("guild-b", { id: "guild-b", shardId: 1 } as Guild)
    registerMembershipInvalidationEvents(client, {
        invalidate: async (guild) => {
            calls.push(guild)
        },
        reconcile: () => {
            calls.push("reconcile")
        },
        failed: () => {
            throw new Error("Unexpected failure")
        },
    })
    const settle = () => new Promise<void>((resolve) => setImmediate(resolve))
    client.emit(Events.ShardReconnecting, 0)
    await settle()
    assert.deepEqual(calls, ["guild-a"])
    calls.length = 0
    for (const event of [Events.ShardResume, Events.ShardReady] as const) {
        client.emit(event, 0, null as never)
        await settle()
    }
    assert.deepEqual(calls, ["guild-a", "reconcile", "guild-a", "reconcile"])
    calls.length = 0
    client.emit(Events.GuildRoleDelete, { guild: { id: "guild-a" } } as never)
    client.emit(
        Events.GuildRoleUpdate,
        {} as never,
        { guild: { id: "guild-b" } } as never
    )
    await settle()
    assert.deepEqual(calls.slice(0, 2), ["guild-a", "guild-b"])
    assert.equal(calls.filter((value) => value === "reconcile").length, 2)
    client.removeAllListeners()
})
