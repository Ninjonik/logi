import { isBotInsideDiscordGuild } from "./discord"
import assert from "node:assert/strict"
import test from "node:test"

process.env.DISCORD_BOT_TOKEN = "synthetic-test-token"

test("strict presence checks distinguish absent bot from Discord failures", async (t) => {
    for (const status of [200, 403, 404, 401, 429, 500]) {
        const mock = t.mock.method(
            globalThis,
            "fetch",
            async () => new Response(null, { status })
        )
        if (status === 200 || status === 403 || status === 404) {
            assert.equal(
                await isBotInsideDiscordGuild("guild", { strict: true }),
                status === 200
            )
        } else {
            await assert.rejects(
                isBotInsideDiscordGuild("guild", { strict: true }),
                /presence check failed/
            )
        }
        mock.mock.restore()
    }
})

test("strict checks reject missing credentials rather than declaring the bot absent", async () => {
    delete process.env.DISCORD_BOT_TOKEN
    await assert.rejects(
        isBotInsideDiscordGuild("guild", { strict: true }),
        /token is missing/
    )
    assert.equal(await isBotInsideDiscordGuild("guild"), false)
})
