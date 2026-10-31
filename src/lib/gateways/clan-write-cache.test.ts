import { clanWriteCacheTags } from "./clan-write-cache"
import { appCacheTags } from "../cache-tags"
import assert from "node:assert/strict"
import test from "node:test"

test("v1 writes invalidate both clan aggregate caches and affected detail caches", () => {
    const tags = clanWriteCacheTags(
        "guilds:one",
        "discord-guild",
        JSON.stringify({
            data: {
                id: "rosters:one",
                eventId: "events:one",
                userId: "player",
            },
        })
    )
    for (const expected of [
        appCacheTags.serverContext("guilds:one"),
        appCacheTags.roster("rosters:one"),
        appCacheTags.event("events:one"),
        appCacheTags.player("player"),
        appCacheTags.publicClan("discord-guild"),
    ])
        assert.ok(tags.includes(expected), expected)
    assert.ok(!tags.includes(appCacheTags.serverContext("discord-guild")))
    assert.ok(!tags.includes(appCacheTags.serverContext("guilds:other")))
})

test("delete responses still invalidate their detail and overview caches", () => {
    const tags = clanWriteCacheTags(
        "guilds:one",
        "discord-guild",
        '{"data":{"id":"groups:deleted","deleted":true}}'
    )
    assert.ok(tags.includes(appCacheTags.group("groups:deleted")))
    assert.ok(tags.includes(appCacheTags.groups("guilds:one")))
})
