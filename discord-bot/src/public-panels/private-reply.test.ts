import type { InteractionEditReplyOptions } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

import { completePrivatePlayerReply } from "./private-reply"

const fallback: InteractionEditReplyOptions = { content: "fallback card" }

test("a deferred player reply ends with the fallback card on rejection or timeout instead of spinning", async () => {
    for (const load of [
        async () => {
            throw Error("private provider diagnostic")
        },
        () => new Promise<InteractionEditReplyOptions>(() => {}),
    ]) {
        const replies: InteractionEditReplyOptions[] = []
        await completePrivatePlayerReply(
            async (reply) => {
                replies.push(reply)
            },
            load,
            2,
            fallback
        )
        assert.deepEqual(replies, [fallback])
        assert.ok(!JSON.stringify(replies).includes("diagnostic"))
    }
})

test("a reply Discord rejects is replaced with the fallback card", async () => {
    const replies: InteractionEditReplyOptions[] = []
    await completePrivatePlayerReply(
        async (reply) => {
            replies.push(reply)
            if (replies.length === 1) throw Error("Discord rejected components")
        },
        async () => ({ content: "players" }),
        1000,
        fallback
    )
    assert.deepEqual(replies, [{ content: "players" }, fallback])
})

test("a reply in time is delivered once", async () => {
    const replies: InteractionEditReplyOptions[] = []
    await completePrivatePlayerReply(
        async (reply) => {
            replies.push(reply)
        },
        async () => ({ content: "players" }),
        1000,
        fallback
    )
    assert.deepEqual(replies, [{ content: "players" }])
})
