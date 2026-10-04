import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import { invoke, testContext } from "./testing/database"
import * as gameData from "../../../convex/gameData"
import test, { type TestContext } from "node:test"
import * as keys from "../../../convex/publicApi"
import assert from "node:assert/strict"

const secret = "dev-internal-auth-secret"
function fixture(t: TestContext) {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    const ctx = testContext()
    seedDashboardActor(ctx.db)
    ctx.db.seed("apiKeys", {
        _id: "keys:old",
        guildId: "guild-a",
        keyHash: "old",
        keyPrefix: "fixture",
        name: "Fixture",
        createdAt: "2030-01-01T00:00:00Z",
    })
    return ctx
}
const keyInput = {
    secret,
    guildId: "guild-a",
    actor: actorFixture,
    name: "Fixture",
    keyHash: "new",
    keyPrefix: "fixture",
    keyId: "keys:old",
}

test("API key management accepts the current bound dashboard administrator", async (t) => {
    const ctx = fixture(t)
    const created = await invoke(keys.createKey, ctx, keyInput)
    assert.ok(created)
    assert.equal((await invoke(keys.listKeys, ctx, keyInput)).length, 2)
    await invoke(keys.revokeKey, ctx, keyInput)
    assert.ok((await ctx.db.get("keys:old"))?.revokedAt)
})

test("each API key operation rejects revoked, expired, rebound, cross-guild and missing actors before effects", async (t) => {
    for (const operation of [keys.createKey, keys.listKeys, keys.revokeKey]) {
        for (const mode of [
            "rights",
            "global-logout",
            "logout",
            "expiry",
            "subject",
            "native-id",
            "guild",
            "missing",
        ]) {
            const ctx = fixture(t)
            const args = structuredClone(keyInput) as Record<string, unknown>
            if (mode === "rights")
                await ctx.db.patch("access:admin", {
                    isAdmin: false,
                    hasDashboardAccess: false,
                })
            if (mode === "global-logout")
                await ctx.db.patch(actorFixture.userRecordId, {
                    sessionVersion: 1,
                })
            if (mode === "logout")
                await ctx.db.patch("sessions:admin", { revokedAt: Date.now() })
            if (mode === "expiry")
                await ctx.db.patch("sessions:admin", {
                    expiresAt: Date.now() - 1,
                })
            if (mode === "subject")
                await ctx.db.patch(actorFixture.userRecordId, {
                    discordId: "100000000000000002",
                })
            if (mode === "native-id")
                args.actor = { ...actorFixture, userRecordId: "users:another" }
            if (mode === "guild") args.guildId = "another-guild"
            if (mode === "missing") delete args.actor
            const before = structuredClone(ctx.db.tables.apiKeys)
            await assert.rejects(invoke(operation, ctx, args), /Forbidden/)
            assert.deepEqual(ctx.db.tables.apiKeys, before, mode)
        }
    }
})

test("source configuration checks current dashboard authority in the writer transaction", async (t) => {
    const ctx = fixture(t)
    const previous = process.env.LOGI_GAME_DATA_SOURCES
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([
        {
            ref: "primary",
            guildId: "guild-a",
            gameId: "wardogs",
            provider: "wardogs_rcon",
            providerServerId: "one",
            origin: "https://provider.example",
            secretRef: "LOGI_GAME_DATA_FIXTURE_TOKEN",
            allowedAddresses: [],
        },
    ])
    t.after(() => {
        if (previous === undefined) delete process.env.LOGI_GAME_DATA_SOURCES
        else process.env.LOGI_GAME_DATA_SOURCES = previous
    })
    const input = {
        secret,
        guildId: "guild-a",
        actor: actorFixture,
        sourceRef: "primary",
        enabled: true,
    }
    const id = await invoke(gameData.configureForDashboard, ctx, input)
    assert.equal((await ctx.db.get(id))?.enabled, true)
    for (const mode of ["rights", "session"]) {
        await ctx.db.patch(
            mode === "rights" ? "access:admin" : "sessions:admin",
            mode === "rights"
                ? { isAdmin: false, hasDashboardAccess: false }
                : { revokedAt: Date.now() }
        )
        const before = structuredClone(await ctx.db.get(id))
        const scheduled = ctx.scheduler.calls.length
        await assert.rejects(
            invoke(gameData.configureForDashboard, ctx, {
                ...input,
                enabled: false,
            }),
            /Forbidden/
        )
        assert.deepEqual(await ctx.db.get(id), before)
        assert.equal(ctx.scheduler.calls.length, scheduled)
        await ctx.db.patch("access:admin", {
            isAdmin: true,
            hasDashboardAccess: true,
        })
    }
})
