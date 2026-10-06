import { createManagedRoleDiscord } from "./managed-roles"
import assert from "node:assert/strict"
import test from "node:test"
const guildId = "111111111111111111",
    targetId = "222222222222222222",
    actorId = "333333333333333333",
    botId = "444444444444444444",
    roleId = "555555555555555555",
    botRole = "666666666666666666"
test("fresh Discord reads check hierarchy and single-role writes preserve unrelated roles", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const adapter = createManagedRoleDiscord({
        token: "synthetic",
        guildId,
        userId: targetId,
        actorId,
        botUserId: botId,
        operationId: "synthetic-op",
        fetch: async (url, init) => {
            calls.push({ url: String(url), init })
            if (init?.method) return new Response(null, { status: 204 })
            if (String(url).endsWith(`/guilds/${guildId}`))
                return Response.json({
                    id: guildId,
                    owner_id: actorId,
                    roles: [
                        {
                            id: guildId,
                            permissions: "0",
                            position: 0,
                            managed: false,
                        },
                        {
                            id: roleId,
                            permissions: "0",
                            position: 1,
                            managed: false,
                        },
                        {
                            id: botRole,
                            permissions: "268435456",
                            position: 2,
                            managed: false,
                        },
                    ],
                })
            const id = String(url).split("/").at(-1)
            return Response.json({
                user: { id },
                roles: id === botId ? [botRole] : [],
                pending: false,
            })
        },
    })
    const snapshot = await adapter.observe()
    assert.equal(snapshot.evidence.actorAdministrator, true)
    assert.equal(snapshot.targetEligible, true)
    assert.deepEqual(snapshot.manageableRoleIds, [roleId])
    await adapter.change("add", roleId)
    assert.equal(calls.at(-1)?.init?.method, "PUT")
    assert.equal(calls.at(-1)?.init?.body, undefined)
    assert.equal(
        calls.at(-1)?.url,
        `https://discord.com/api/v10/guilds/${guildId}/members/${targetId}/roles/${roleId}`
    )
    assert.ok(
        calls.every(
            (call) => call.init?.redirect === "error" && call.init.signal
        )
    )
})
test("Discord 429 supplies bounded Retry-After and never treats missing guild as a departed target", async () => {
    const adapter = createManagedRoleDiscord({
        token: "synthetic",
        guildId,
        userId: targetId,
        actorId,
        botUserId: botId,
        operationId: "synthetic",
        fetch: async () =>
            Response.json({ retry_after: 12.5 }, { status: 429 }),
    })
    await assert.rejects(
        adapter.observe(),
        (error: unknown) =>
            error instanceof Error &&
            "retryAfterMs" in error &&
            error.retryAfterMs === 12500
    )
    const unavailable = createManagedRoleDiscord({
        token: "synthetic",
        guildId,
        userId: targetId,
        actorId,
        botUserId: botId,
        operationId: "synthetic",
        fetch: async () => Response.json({ code: 10004 }, { status: 404 }),
    })
    await assert.rejects(unavailable.observe(), /provider_unavailable/)
})
test("a refused role change keeps Discord's code for the errors channel (L5-14)", async () => {
    const adapter = createManagedRoleDiscord({
        token: "synthetic",
        guildId,
        userId: targetId,
        actorId,
        botUserId: botId,
        operationId: "synthetic",
        fetch: async () =>
            Response.json(
                { code: 50013, message: "Missing Permissions" },
                { status: 403 }
            ),
    })
    await assert.rejects(
        adapter.change("add", roleId),
        (error: unknown) =>
            error instanceof Error &&
            error.message === "discord_forbidden" &&
            "discordCode" in error &&
            error.discordCode === 50013 &&
            "denied" in error &&
            error.denied === true
    )
})
