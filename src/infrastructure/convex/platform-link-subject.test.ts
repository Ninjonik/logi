import {
    getDiscordPlatformLinkState,
    linkDiscordPlatformId,
    unlinkDiscordPlatformId,
} from "../../../convex/players"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

const secret = "dev-internal-auth-secret",
    actor = "111111111111111111",
    other = "222222222222222222"
const steam = "76561198199051397"
const input = {
    secret,
    userId: actor,
    userName: "Synthetic",
    userAvatar: "",
    platformId: steam,
}

for (const discordId of [undefined, other]) {
    test(`legacy platform management cannot claim an imported ID collision (${discordId ?? "unlinked"})`, async () => {
        const ctx = testContext()
        ctx.db.seed("users", {
            _id: "users:import",
            id: actor,
            discordId,
            name: "Imported",
            platformIds: [steam],
        })
        const before = structuredClone(ctx.db.tables.users)
        assert.equal(
            await invoke(getDiscordPlatformLinkState, ctx, {
                secret,
                userId: actor,
            }),
            null
        )
        await assert.rejects(invoke(linkDiscordPlatformId, ctx, input))
        await assert.rejects(
            invoke(unlinkDiscordPlatformId, ctx, {
                secret,
                userId: actor,
                platformId: steam,
            })
        )
        assert.deepEqual(ctx.db.tables.users, before)
    })
}

test("legacy linking rejects a Steam ID already recorded with the steam prefix", async () => {
    const ctx = testContext()
    ctx.db.seed("users", {
        _id: "users:other",
        id: other,
        discordId: other,
        platformIds: [`steam:${steam}`],
    })
    await assert.rejects(
        invoke(linkDiscordPlatformId, ctx, input),
        /already linked/
    )
    assert.equal(ctx.db.tables.users.length, 1)
})

test("legacy linking rejects another account's verified Steam identity", async () => {
    const ctx = testContext()
    ctx.db.seed("platformIdentityLinks", {
        _id: "platformIdentityLinks:other",
        platform: "steam",
        platformId: steam,
        discordUserId: other,
        active: true,
    })
    await assert.rejects(
        invoke(linkDiscordPlatformId, ctx, input),
        /already linked/
    )
    assert.equal(ctx.db.tables.users?.length ?? 0, 0)
})

test("exact Discord binding can link and unlink its own platform", async () => {
    const ctx = testContext()
    ctx.db.seed("users", {
        _id: "users:actor",
        id: "import-owned",
        discordId: actor,
        name: "Owner",
        platformIds: [],
        nicknames: {},
    })
    await invoke(linkDiscordPlatformId, ctx, input)
    assert.deepEqual(
        (
            await invoke(getDiscordPlatformLinkState, ctx, {
                secret,
                userId: actor,
            })
        ).platformIds,
        [steam]
    )
    await invoke(unlinkDiscordPlatformId, ctx, {
        secret,
        userId: actor,
        platformId: steam,
    })
    assert.deepEqual(ctx.db.tables.users[0].platformIds, [])
})
