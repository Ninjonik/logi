import { findNoticeTarget } from "../../../convex/events"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

test("Discord notice lookup includes canonical and legacy guild event keys without crossing communities", async () => {
    const ctx = testContext()
    const guildId = "111111111111111111",
        userId = "222222222222222222"
    ctx.db.seed("guilds", { _id: "guilds:local", discordId: guildId })
    const future = new Date(Date.now() + 86400_000).toISOString()
    for (const [id, owner] of [
        ["canonical", "guilds:local"],
        ["legacy", guildId],
        ["foreign", "guilds:foreign"],
    ]) {
        ctx.db.seed("events", {
            _id: id,
            guildId: owner,
            name: `Notice ${id}`,
            status: "registration",
            gameStart: future,
            meetingStart: future,
            registrationEnd: future,
            participants: [
                {
                    userId,
                    status: "attending",
                    updatedAt: new Date().toISOString(),
                },
            ],
        })
    }
    const result = await invoke(findNoticeTarget, ctx, {
        secret: "dev-internal-auth-secret",
        guildId,
        userId,
        query: "Notice",
    })
    assert.deepEqual(result.map((e: { id: string }) => e.id).sort(), [
        "canonical",
        "legacy",
    ])
})

test("Discord notice lookup rejects missing bot authentication and conflicting legacy guild aliases", async () => {
    const ctx = testContext(),
        guildId = "111111111111111111",
        userId = "222222222222222222"
    await assert.rejects(
        invoke(findNoticeTarget, ctx, {
            secret: "wrong",
            guildId,
            userId,
            query: "",
        }),
        /Unauthorized/
    )
    ctx.db.seed("guilds", {
        _id: "guilds:other",
        id: guildId,
        discordId: "333333333333333333",
    })
    ctx.db.seed("events", {
        _id: "event:other",
        guildId: "guilds:other",
        name: "Hidden",
        status: "registration",
        gameStart: new Date(Date.now() + 86400_000).toISOString(),
        participants: [{ userId, status: "attending" }],
    })
    assert.deepEqual(
        await invoke(findNoticeTarget, ctx, {
            secret: "dev-internal-auth-secret",
            guildId,
            userId,
            query: "",
        }),
        []
    )
})
