import { revokePlatformIdentity } from "../../../convex/platformIdentityStore"
import type { MutationCtx } from "../../../convex/_generated/server"
import * as links from "../../../convex/platformIdentityLinks"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

const secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")
const sessionHash = "a".repeat(64)
const platformId = "76561198000000001"
function fixture() {
    const ctx = testContext()
    ctx.db.seed("users", {
        _id: "users:a",
        id: "imported-a",
        discordId: "discord-a",
        platformIds: [platformId],
    })
    ctx.db.seed("users", {
        _id: "users:b",
        id: "imported-b",
        discordId: "discord-b",
        platformIds: [platformId],
    })
    return ctx
}
async function claimed(
    ctx: ReturnType<typeof fixture>,
    discordUserId = "discord-a",
    tokenHash = "b".repeat(64)
) {
    const input = { secret, sessionHash, discordUserId, tokenHash }
    await invoke(links.begin, ctx, {
        ...input,
        returnOrigin: "https://logi.test",
        locale: "cs",
        expiresAt: Date.now() + 600_000,
    })
    return invoke(links.claim, ctx, input)
}
const finish = (
    challengeId: string,
    discordUserId = "discord-a",
    nonceHash = "c".repeat(64)
) => ({
    secret,
    sessionHash,
    discordUserId,
    challengeId,
    platformId,
    nonceHash,
})

test("manually entered ID remains claimed; only verified completion creates proof", async () => {
    const ctx = fixture()
    assert.deepEqual(
        await invoke(links.list, ctx, { secret, discordUserId: "discord-a" }),
        []
    )
    const challenge = await claimed(ctx)
    const link = await invoke(links.complete, ctx, finish(challenge.id))
    assert.equal(link.logiUserId, "imported-a")
    assert.equal(link.method, "steam_openid")
    assert.deepEqual((await ctx.db.get("users:a"))?.platformIds, [platformId])
    await assert.rejects(invoke(links.complete, ctx, finish(challenge.id)))
})
test("competing verified links of same SteamID conflict within the serializable transaction", async () => {
    const ctx = fixture()
    const a = await claimed(ctx)
    const b = await claimed(ctx, "discord-b", "d".repeat(64))
    await invoke(links.complete, ctx, finish(a.id))
    await assert.rejects(
        invoke(links.complete, ctx, finish(b.id, "discord-b", "e".repeat(64))),
        /already linked/
    )
    assert.equal(
        ctx.db.tables.platformIdentityLinks.filter((row) => row.active).length,
        1
    )
})
test("challenge cannot be reused, claimed by other sessions, or completed after unlink", async () => {
    const ctx = fixture()
    const a = await claimed(ctx)
    await assert.rejects(
        invoke(links.claim, ctx, {
            secret,
            sessionHash,
            discordUserId: "discord-a",
            tokenHash: "b".repeat(64),
        })
    )
    await assert.rejects(
        invoke(links.complete, ctx, { ...finish(a.id), sessionHash: "other" })
    )
    await invoke(links.unlink, ctx, { secret, discordUserId: "discord-a" })
    await assert.rejects(invoke(links.complete, ctx, finish(a.id)))
})
test("unlink keeps a revoked audit, rejects replayed nonce, and invalidates future attribution", async () => {
    const ctx = fixture()
    const a = await claimed(ctx)
    await invoke(links.complete, ctx, finish(a.id))
    await invoke(links.unlink, ctx, { secret, discordUserId: "discord-a" })
    const history = await invoke(links.list, ctx, {
        secret,
        discordUserId: "discord-a",
    })
    assert.ok(history[0].revokedAt)
    const b = await claimed(ctx, "discord-b", "d".repeat(64))
    await assert.rejects(
        invoke(links.complete, ctx, finish(b.id, "discord-b")),
        /replayed/
    )
})
test("identity replacement, merge or changed Discord mapping cannot inherit proof", async () => {
    for (const mode of ["replace", "relink", "merge"]) {
        const ctx = fixture()
        const a = await claimed(ctx)
        if (mode === "replace") await ctx.db.delete("users:a")
        if (mode === "relink")
            await ctx.db.patch("users:a", { discordId: "different-discord" })
        if (mode === "merge")
            await revokePlatformIdentity(
                ctx as unknown as MutationCtx,
                "users:a" as never
            )
        await assert.rejects(invoke(links.complete, ctx, finish(a.id)))
    }
})
test("internal secret is mandatory and link starts are throttled", async () => {
    const ctx = fixture()
    await assert.rejects(
        invoke(links.list, ctx, { secret: "bad", discordUserId: "discord-a" })
    )
    await claimed(ctx)
    await assert.rejects(
        invoke(links.begin, ctx, {
            secret,
            discordUserId: "discord-a",
            sessionHash,
            tokenHash: "f".repeat(64),
            returnOrigin: "https://logi.test",
            locale: "en",
            expiresAt: Date.now() + 600_000,
        }),
        /wait/i
    )
})

test("stored expiry and logout cancellation block completion; challenge history stays bounded", async () => {
    const ctx = fixture()
    const a = await claimed(ctx)
    await invoke(links.cancelSession, ctx, {
        secret,
        discordUserId: "discord-a",
        sessionHash,
    })
    await assert.rejects(invoke(links.complete, ctx, finish(a.id)))
    for (let index = 0; index < 12; index++) {
        for (const row of ctx.db.tables.platformLinkChallenges)
            row.createdAt -= 31_000
        const b = await claimed(
            ctx,
            "discord-a",
            (index + 10).toString(16).padStart(64, "0")
        )
        await ctx.db.patch(b.id, { expiresAt: Date.now() - 1 })
        await assert.rejects(invoke(links.complete, ctx, finish(b.id)))
    }
    assert.equal(ctx.db.tables.platformLinkChallenges.length, 10)
    assert.equal((ctx.db.tables.platformIdentityLinks ?? []).length, 0)
})
