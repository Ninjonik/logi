import { registerMembershipInvalidationEvents } from "./membership-events"
import { Client, Events, type Guild } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

function fixture() {
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
    return { client, calls }
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve))
const role = (guildId: string, permissions: number) =>
    ({
        guild: { id: guildId },
        permissions: { bitfield: BigInt(permissions) },
    }) as never

test("a new session invalidates its shard's guilds before requesting reconciliation", async () => {
    const { client, calls } = fixture()
    client.emit(Events.ShardReady, 0, null as never)
    await settle()
    assert.deepEqual(calls, ["guild-a", "reconcile"])
    calls.length = 0
    client.emit(Events.GuildRoleDelete, role("guild-a", 0))
    client.emit(Events.GuildAvailable, { id: "guild-b" } as never)
    await settle()
    assert.deepEqual(calls.slice(0, 2), ["guild-a", "guild-b"])
    assert.equal(calls.filter((value) => value === "reconcile").length, 2)
    client.removeAllListeners()
})

test("a resumed or reconnecting session invalidates nothing: Discord replays what it missed", async () => {
    const { client, calls } = fixture()
    client.emit(Events.ShardDisconnect, {} as never, 0)
    client.emit(Events.ShardReconnecting, 0)
    client.emit(Events.ShardResume, 0, 12)
    await settle()
    assert.deepEqual(calls, [])
    client.removeAllListeners()
})

test("a role update invalidates only when the role's permissions changed", async () => {
    const { client, calls } = fixture()
    // Position, colour or name: same permissions, no stored member data changes.
    client.emit(Events.GuildRoleUpdate, role("guild-a", 8), role("guild-a", 8))
    await settle()
    assert.deepEqual(calls, [])
    // Administrator granted or revoked changes dashboard access.
    client.emit(Events.GuildRoleUpdate, role("guild-b", 0), role("guild-b", 8))
    await settle()
    assert.deepEqual(calls, ["guild-b", "reconcile"])
    client.removeAllListeners()
})
