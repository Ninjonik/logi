import { membershipPolicyHandlers } from "./membership-policy-route"
import assert from "node:assert/strict"
import test from "node:test"
test("membership policy management behind a proxy requires an admin session and binds the trusted guild", async () => {
    let admin = false,
        writes = 0
    const input = {
        apiKeyId: "key-a",
        enabled: true,
        games: [{ gameId: "wardogs", roleIds: ["333333333333333333"] }],
    }
    const handlers = membershipPolicyHandlers({
        origin: "https://logi.test",
        authorize: async () => (admin ? "trusted-guild" : null),
        list: async () => [],
        configure: async (guild, value) => {
            assert.equal(guild, "trusted-guild")
            assert.deepEqual(value, input)
            writes++
        },
    })
    const request = (body: unknown, origin = "https://logi.test") =>
        new Request("http://127.0.0.1:3000/api", {
            method: "POST",
            headers: { origin, Authorization: "Bearer cannot-admin" },
            body: JSON.stringify(body),
        })
    assert.equal((await handlers.GET(request(input), "server-a")).status, 403)
    assert.equal((await handlers.POST(request(input), "server-a")).status, 403)
    admin = true
    assert.equal(
        (await handlers.POST(request(input, "https://other.test"), "server-a"))
            .status,
        403
    )
    for (const body of [
        { ...input, guildId: "other" },
        { ...input, games: [{ gameId: "wardogs", roleIds: ["invalid"] }] },
        { ...input, secret: "injected" },
        "x".repeat(17000),
    ])
        assert.equal(
            (await handlers.POST(request(body), "server-a")).status,
            400
        )
    const saved = await handlers.POST(request(input), "server-a")
    assert.equal(saved.status, 200)
    assert.equal(saved.headers.get("cache-control"), "no-store")
    assert.equal(writes, 1)
})
