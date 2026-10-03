import type { InteractionEditReplyOptions } from "discord.js"
import { completePrivatePlayerReply } from "./private-reply"
import assert from "node:assert/strict"
import test from "node:test"
test("a deferred player response resolves to a private error on rejection or timeout instead of spinning", async () => {
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
            2
        )
        assert.equal(replies.length, 1)
        assert.match(String(replies[0].content), /unavailable/)
        assert.ok(!String(replies[0].content).includes("diagnostic"))
    }
})
test("a rejected render payload is replaced with a plain-text fallback", async () => {
    let calls = 0
    await completePrivatePlayerReply(
        async (reply) => {
            calls++
            if (calls === 1) throw Error("Discord rejected components")
            assert.match(String(reply.content), /unavailable/)
        },
        async () => ({ content: "players" })
    )
    assert.equal(calls, 2)
})
