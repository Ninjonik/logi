import * as discordConfig from "../../../convex/discordConfig"
import { seedDashboardActor } from "./testing/dashboard-actor"
import * as selfGroups from "../../../convex/selfGroups"
import { invoke, testContext } from "./testing/database"
import * as publicApi from "../../../convex/publicApi"
import * as groups from "../../../convex/groups"
import assert from "node:assert/strict"
import test from "node:test"

const secret = "synthetic-self-groups"
const guildId = "100000000000000100"
function fixture() {
    process.env.INTERNAL_AUTH_SECRET = secret
    const ctx = testContext()
    seedDashboardActor(ctx.db, guildId)
    ctx.db.seed("groups", {
        _id: "groups:tank",
        guildId,
        gameId: "hell_let_loose",
        name: "Tanker",
        order: 0,
    })
    ctx.db.seed("groups", {
        _id: "groups:primary",
        guildId,
        name: "Infantry",
        order: 1,
    })
    ctx.db.seed("groups", {
        _id: "groups:other",
        guildId: "other",
        name: "Foreign",
        order: 0,
    })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:one",
        guildId,
        timezone: "UTC",
        defaultLanguage: "cs",
        selfAssignableGroupIds: ["groups:tank"],
    })
    ctx.db.seed("apiKeys", { _id: "apiKeys:one", guildId, keyHash: "hash" })
    return ctx
}

test("dashboard and API self-group settings validate ownership; group deletion cleans the allowlist", async () => {
    const ctx = fixture()
    await assert.rejects(
        invoke(discordConfig.upsertConfig, ctx, {
            secret,
            guildId: "guilds:admin",
            selfAssignableGroupIds: ["groups:other"],
        })
    )
    await invoke(discordConfig.upsertConfig, ctx, {
        secret,
        guildId: "guilds:admin",
        selfAssignableGroupIds: ["groups:tank", "groups:primary"],
    })
    const api = (groupIds: string[], key: string) =>
        invoke(publicApi.mutateClanSettings, ctx, {
            secret,
            keyHash: "hash",
            idempotencyKey: key,
            bodyHash: key,
            methodPath: "PATCH /clan/settings",
            slices: { selfGroups: { groupIds } },
        })
    assert.equal((await api(["groups:other"], "wrong")).status, 400)
    const saved = await api(["groups:tank"], "valid")
    assert.equal(saved.status, 200)
    assert.deepEqual(await api(["groups:tank"], "valid"), saved)
    assert.deepEqual(
        (await ctx.db.get("discordConfigs:one"))?.selfAssignableGroupIds,
        ["groups:tank"]
    )
    await invoke(groups.remove, ctx, {
        secret,
        guildId: "guilds:admin",
        groupId: "groups:tank",
    })
    assert.deepEqual(
        (await ctx.db.get("discordConfigs:one"))?.selfAssignableGroupIds,
        []
    )
})

test("self-group mutation rechecks the allowlist, game membership, primary group and caller secret", async () => {
    const ctx = fixture()
    const userId = "100000000000000222"
    ctx.db.seed("users", {
        _id: "users:player",
        id: userId,
        discordId: userId,
        name: "Player",
        nicknames: {},
        mercenaryGuildIds: [],
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:player",
        serverId: guildId,
        gameId: "hell_let_loose",
        userId,
        type: "member",
        status: "active",
        primaryGroupId: "groups:primary",
        secondaryGroupIds: [],
        paused: false,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
    })
    const request = {
        secret,
        guildId,
        userId,
        groupId: "groups:tank",
        enabled: true,
    }
    await assert.rejects(
        invoke(selfGroups.options, ctx, { secret: "wrong", guildId, userId })
    )
    await assert.rejects(
        invoke(selfGroups.set, ctx, { ...request, secret: "wrong" })
    )
    await invoke(selfGroups.set, ctx, request)
    await invoke(selfGroups.set, ctx, request)
    assert.deepEqual(
        (await ctx.db.get("userAssignments:player"))?.secondaryGroupIds,
        ["groups:tank"]
    )
    assert.equal(
        (await ctx.db.get("userAssignments:player"))?.primaryGroupId,
        "groups:primary"
    )
    await assert.rejects(
        invoke(selfGroups.set, ctx, { ...request, groupId: "groups:other" })
    )
    await ctx.db.patch("discordConfigs:one", {
        selfAssignableGroupIds: ["groups:primary"],
    })
    await assert.rejects(invoke(selfGroups.set, ctx, request))
    await assert.rejects(
        invoke(selfGroups.set, ctx, {
            ...request,
            groupId: "groups:primary",
            enabled: false,
        })
    )
    await ctx.db.patch("discordConfigs:one", {
        selfAssignableGroupIds: ["groups:tank"],
    })
    await ctx.db.patch("groups:tank", { gameId: "wardogs" })
    await assert.rejects(invoke(selfGroups.set, ctx, request))
    const options = await invoke(selfGroups.options, ctx, {
        secret,
        guildId,
        userId,
    })
    assert.deepEqual(options.groups, [])
})

test("self-service includes recruits, full members, reserves and mercenaries with game-scoped choices", async () => {
    for (const [type, status] of [
        ["member", "recruit"],
        ["member", "active"],
        ["reserve_member", "active"],
        ["mercenary", "active"],
    ]) {
        const ctx = fixture()
        const userId = "100000000000000222"
        ctx.db.seed("users", {
            _id: "users:player",
            id: userId,
            discordId: userId,
            name: "Player",
            nicknames: {},
            mercenaryGuildIds: [],
        })
        ctx.db.seed("userAssignments", {
            _id: "userAssignments:player",
            serverId: guildId,
            userId,
            gameId: "hell_let_loose",
            type,
            status,
            secondaryGroupIds: [],
            paused: false,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
        })
        ctx.db.seed("userAssignments", {
            _id: "userAssignments:second",
            serverId: guildId,
            userId,
            gameId: "wardogs",
            type,
            status,
            secondaryGroupIds: [],
            paused: false,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
        })
        ctx.db.seed("userAssignments", {
            _id: "userAssignments:pending",
            serverId: guildId,
            userId,
            gameId: "pending-game",
            type: "member",
            status: "pending",
            secondaryGroupIds: [],
            paused: false,
        })
        const options = await invoke(selfGroups.options, ctx, {
            secret,
            guildId,
            userId,
        })
        assert.deepEqual(
            options.games.map((game: { id: string }) => game.id),
            ["hell_let_loose", "wardogs"]
        )
        assert.deepEqual(
            options.groups.map((group: { id: string }) => group.id),
            ["groups:tank"]
        )
        await assert.rejects(
            invoke(selfGroups.set, ctx, {
                secret,
                guildId,
                userId,
                gameId: "wardogs",
                groupId: "groups:tank",
                enabled: true,
            })
        )
        await invoke(selfGroups.set, ctx, {
            secret,
            guildId,
            userId,
            gameId: "hell_let_loose",
            groupId: "groups:tank",
            enabled: true,
        })
        assert.deepEqual(
            (await ctx.db.get("userAssignments:player"))?.secondaryGroupIds,
            ["groups:tank"]
        )
        assert.deepEqual(
            (await ctx.db.get("userAssignments:second"))?.secondaryGroupIds,
            []
        )
    }
})
