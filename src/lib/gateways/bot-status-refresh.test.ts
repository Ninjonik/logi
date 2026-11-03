import { refreshManagedBotStatus } from "./bot-status-refresh"
import assert from "node:assert/strict"
import test from "node:test"

const user = { id: "player-record", discordId: "discord-user" }
const guilds = [
    {
        id: "guild-record",
        discordId: "discord-guild",
        name: "Clan",
        avatar: "",
    },
]

test("refresh persists Discord presence before expiring both dashboard cache aliases", async () => {
    const order: string[] = []
    await refreshManagedBotStatus(user, guilds, {
        check: async (id) => {
            assert.equal(id, "discord-guild")
            order.push("check")
            return true
        },
        sync: async (id, checked) => {
            assert.equal(id, "discord-user")
            assert.equal(checked[0].botInside, true)
            order.push("sync")
        },
        invalidate: (tags) => {
            assert.deepEqual(order, ["check", "sync"])
            for (const tag of [
                "server-context:guild-record",
                "server-context:discord-guild",
                "server:guild-record",
                "player:player-record",
                "users",
            ])
                assert.ok(tags.includes(tag), tag)
            assert.ok(!tags.includes("server-context:other-guild"))
        },
    })
})

test("failed checks do not overwrite known bot presence", async () => {
    await assert.rejects(
        refreshManagedBotStatus(user, guilds, {
            check: async () => {
                throw new Error("Discord unavailable")
            },
            sync: async () => assert.fail("must not persist false presence"),
            invalidate: () => assert.fail("must not report successful refresh"),
        }),
        /Discord unavailable/
    )
})
