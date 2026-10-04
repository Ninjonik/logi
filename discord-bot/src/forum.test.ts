import assert from "node:assert/strict"
import test from "node:test"

import { ChannelType } from "discord.js"

import { findRecoverableEventForum } from "./forum"

test("forum recovery selects the oldest matching event forum", () => {
    const recovered = findRecoverableEventForum(
        [
            {
                id: "other-parent",
                name: "wardogs-match-10-10-2026",
                parentId: "other",
                type: ChannelType.GuildForum,
                createdTimestamp: 1,
            },
            {
                id: "newer-match",
                name: "wardogs-match-10-10-2026",
                parentId: "briefings",
                type: ChannelType.GuildForum,
                createdTimestamp: 20,
            },
            {
                id: "oldest-match",
                name: "wardogs-match-10-10-2026",
                parentId: "briefings",
                type: ChannelType.GuildForum,
                createdTimestamp: 10,
            },
        ],
        "briefings",
        "wardogs-match-10-10-2026"
    )

    assert.equal(recovered?.id, "oldest-match")
})
