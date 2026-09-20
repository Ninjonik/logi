import assert from "node:assert/strict"
import test from "node:test"

import type { GuildCacheSnapshot } from "../types"
import { GuildCache } from "./guild-cache"

test("GuildCache accepts snapshots from before assignments were returned", () => {
    const cache = new GuildCache()
    const snapshot = {
        guilds: [
            {
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
            },
        ],
        configs: [],
        groups: [],
        calendarItems: [],
        squadPresets: [],
        topicPresets: [],
    } as unknown as GuildCacheSnapshot

    ;(
        cache as unknown as {
            applySnapshot: (snapshot: GuildCacheSnapshot) => string[]
        }
    ).applySnapshot(snapshot)

    assert.deepEqual(cache.get("guild-1")?.assignments, [])
})
