import assert from "node:assert/strict"
import test from "node:test"

import type { GuildCacheSnapshot } from "../types"
import { GuildCache } from "./guild-cache"

const guild = {
    id: "guild-record-1",
    discordId: "guild-1",
    name: "Guild",
    avatar: "",
    eventCategories: [],
    calendarItems: [],
    botInside: true,
    adminIds: [],
    memberIds: [],
    mercenaryIds: [],
    updatedAt: "2026-09-20T19:36:11.582Z",
}

function apply(cache: GuildCache, snapshot: unknown) {
    return (
        cache as unknown as {
            applySnapshot: (snapshot: GuildCacheSnapshot) => string[]
        }
    ).applySnapshot(snapshot as GuildCacheSnapshot)
}

test("GuildCache keeps the clan's configuration and no assignments, even from an older Convex deployment that still returns them", () => {
    const cache = new GuildCache()
    const changed = apply(cache, {
        guilds: [guild],
        configs: [],
        groups: [],
        calendarItems: [],
        squadPresets: [],
        topicPresets: [],
        // Returned by the query before assignments moved to their own read.
        assignments: [
            {
                userId: "user-1",
                type: "member",
                status: "active",
                serverId: "guild-1",
            },
        ],
    })

    assert.deepEqual(changed, ["guild-1"])
    const runtime = cache.get("guild-1")
    assert.ok(runtime)
    assert.equal(runtime.guild.id, "guild-record-1")
    assert.equal("assignments" in runtime, false)
})

test("GuildCache reports a guild as changed only when one of its cached rows changed", () => {
    const cache = new GuildCache()
    const snapshot = {
        guilds: [guild],
        configs: [],
        groups: [],
        calendarItems: [],
        squadPresets: [],
        topicPresets: [],
    }
    assert.deepEqual(apply(cache, snapshot), ["guild-1"])
    assert.deepEqual(apply(cache, snapshot), [])
    assert.deepEqual(
        apply(cache, {
            ...snapshot,
            groups: [
                {
                    id: "group-1",
                    guildId: "guild-1",
                    updatedAt: "2026-09-21T00:00:00.000Z",
                },
            ],
        }),
        ["guild-1"]
    )
})
