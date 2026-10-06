import { GET } from "@/app/api/v1/clan/[[...path]]/route"
import assert from "node:assert/strict"
import test from "node:test"
const user = "222222222222222222",
    guild = "111111111111111111"
test("exact membership HTTP lookup is bounded, no-store and reauthorizes after Discord", async (t) => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://offline-test.convex.cloud"
    process.env.INTERNAL_AUTH_SECRET = "synthetic-membership-secret"
    process.env.DISCORD_BOT_TOKEN = "synthetic-offline-token"
    let revoked = false,
        denied = false,
        reads = 0
    const calls: string[] = []
    t.mock.method(
        globalThis,
        "fetch",
        async (url: unknown, init?: RequestInit) => {
            if (String(url).startsWith("https://discord.com/")) {
                calls.push("discord")
                return Response.json({
                    user: { id: user },
                    roles: ["333333333333333333"],
                })
            }
            const request = JSON.parse(String(init?.body)),
                args = request.args[0]
            let value: unknown
            if (request.path === "publicApi:checkRateLimit")
                value = { allowed: true, remaining: 299, resetAt: 0 }
            else if (request.path === "apiKeyAuth:authenticateKey")
                value = {
                    guildId: guild,
                    readAccess: {
                        resources: ["membership-summaries"],
                        gameIds: ["wardogs"],
                    },
                }
            else if (request.path === "memberObservations:prepareLookup") {
                reads++
                calls.push("prepare")
                assert.equal(args.guildId, guild)
                assert.equal(args.discordUserId, user)
                assert.equal(args.maxAgeMs, 60000)
                value = denied
                    ? null
                    : {
                          kind: "refresh",
                          token: {
                              epoch: "1",
                              revision: "0",
                              fence: 1,
                              policyVersion: "1",
                              startedAt: new Date().toISOString(),
                          },
                      }
            } else if (request.path === "memberObservations:completeLookup") {
                calls.push("complete")
                assert.equal(args.result.state, "present")
                value = revoked
                    ? null
                    : {
                          guildId: guild,
                          discordUserId: user,
                          gameId: "wardogs",
                          state: "present",
                          roleIds: ["333333333333333333"],
                          assignment: null,
                          observedAt: args.result.observedAt,
                          receivedAt: new Date().toISOString(),
                          epoch: "1",
                          revision: "2",
                          completeness: "verified_member",
                      }
            } else throw new Error(`Unexpected offline call: ${request.path}`)
            return Response.json({ status: "success", value })
        }
    )
    const call = (
        path = `membership-summaries/${user}`,
        query = "game=wardogs"
    ) =>
        GET(
            new Request(`https://logi.test/api/v1/clan/${path}?${query}`, {
                headers: { Authorization: "Bearer synthetic-reader" },
            }),
            { params: Promise.resolve({ path: path.split("/") }) }
        )
    const ok = await call()
    assert.equal(ok.status, 200)
    assert.equal(ok.headers.get("cache-control"), "no-store")
    assert.deepEqual((await ok.json()).data.roleIds, ["333333333333333333"])
    assert.deepEqual(calls, ["prepare", "discord", "complete"])
    const before = reads
    for (const query of [
        "",
        "game=all",
        "game=wardogs&game=wardogs",
        "game=wardogs&maxAgeMs=300001",
        "game=wardogs&guildId=other",
        "game=hell_let_loose",
    ])
        assert.ok([400, 403].includes((await call(undefined, query)).status))
    assert.equal((await call("membership-summaries")).status, 400)
    assert.equal((await call("membership-summaries/invalid")).status, 400)
    assert.equal(reads, before)
    revoked = true
    assert.equal((await call()).status, 403)
    denied = true
    calls.length = 0
    assert.equal((await call()).status, 403)
    assert.deepEqual(calls, ["prepare"])
})
