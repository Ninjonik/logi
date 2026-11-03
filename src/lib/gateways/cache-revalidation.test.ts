import {
    invalidateAppData,
    type CacheRevalidationPayload,
} from "./cache-revalidation"
import assert from "node:assert/strict"
import test from "node:test"

const payloads: CacheRevalidationPayload[] = [
    { type: "event-changed", serverId: "discord-guild", eventId: "event" },
    {
        type: "assignment-changed",
        serverId: "discord-guild",
        userId: "player",
        assignmentId: "assignment",
    },
    {
        type: "roster-changed",
        serverId: "discord-guild",
        rosterId: "roster",
        eventId: "event",
    },
    { type: "discord-config-changed", serverId: "discord-guild" },
    { type: "server-context-changed", serverId: "discord-guild" },
]

test("every bot change expires Convex and Discord context aliases", async () => {
    for (const payload of payloads) {
        let tags: Array<string | undefined> = []
        await invalidateAppData(payload, {
            resolve: async (id) => {
                assert.equal(id, "discord-guild")
                return { id: "convex-guild", discordId: "discord-guild" }
            },
            invalidate: (values) => {
                tags = values
            },
        })
        assert.ok(tags.includes("server-context:convex-guild"))
        assert.ok(tags.includes("server-context:discord-guild"))
        assert.ok(!tags.includes("server-context:other-guild"))
        if (payload.type === "event-changed") {
            for (const tag of [
                "event:event",
                "matches:convex-guild",
                "rosters:convex-guild",
                "roster-image:v3:event",
                "users",
            ])
                assert.ok(tags.includes(tag), tag)
        }
        if (payload.type === "assignment-changed") {
            for (const tag of [
                "assignments:convex-guild",
                "assignments:discord-guild",
                "assignment:assignment",
                "player:player",
                "users",
            ])
                assert.ok(tags.includes(tag), tag)
        }
    }
})

test("unknown or malformed guild scopes fail instead of reporting false success", async () => {
    for (const server of [
        null,
        {},
        { id: "guild" },
        { id: "", discordId: "discord" },
    ]) {
        await assert.rejects(
            invalidateAppData(payloads[0], {
                resolve: async () => server,
                invalidate: () =>
                    assert.fail("must not invalidate unresolved scope"),
            }),
            /Cannot resolve clan cache scope/
        )
    }
})

test("cache expiration errors propagate so the endpoint can report a retryable failure", async () => {
    await assert.rejects(
        invalidateAppData(payloads[0], {
            resolve: async () => ({
                id: "convex-guild",
                discordId: "discord-guild",
            }),
            invalidate: () => {
                throw new Error("cache unavailable")
            },
        }),
        /cache unavailable/
    )
})
