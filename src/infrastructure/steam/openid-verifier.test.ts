import { createSteamVerifier } from "./openid-verifier"
import assert from "node:assert/strict"
import test from "node:test"

const now = Date.parse("2026-09-29T10:00:00Z")
const callback =
    "https://logi.test/api/platform-links/steam/callback?state=test"
function assertion() {
    return new URLSearchParams({
        state: "test",
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "id_res",
        "openid.op_endpoint": "https://steamcommunity.com/openid/login",
        "openid.claimed_id":
            "https://steamcommunity.com/openid/id/76561198000000001",
        "openid.identity":
            "https://steamcommunity.com/openid/id/76561198000000001",
        "openid.return_to": callback,
        "openid.response_nonce": "2026-09-29T10:00:00Zsynthetic",
        "openid.assoc_handle": "1234567890",
        "openid.signed":
            "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
        "openid.sig": "synthetic-signature",
    })
}
const valid = "ns:http://specs.openid.net/auth/2.0\nis_valid:true\n"
test("reviewed OpenID library verifies against fixed HTTPS endpoint with bounded transport", async () => {
    let calls = 0
    const verify = createSteamVerifier(
        async (url, options) => {
            calls++
            assert.equal(url, "https://steamcommunity.com/openid/login")
            assert.equal(options?.redirect, "error")
            assert.equal(options?.method, "POST")
            assert.ok(options?.signal)
            assert.equal(
                new URLSearchParams(String(options?.body)).get("openid.mode"),
                "check_authentication"
            )
            return new Response(valid)
        },
        () => now
    )
    assert.deepEqual(await verify(assertion(), callback), {
        platformId: "76561198000000001",
        nonce: "2026-09-29T10:00:00Zsynthetic",
    })
    assert.equal(calls, 1)
})
test("wrong Steam provider/return URL, unsigned fields, duplicates and invalid nonce rejected before transport", async () => {
    const verify = createSteamVerifier(
        async () => {
            throw new Error("must not contact provider")
        },
        () => now
    )
    for (const [key, value] of [
        ["openid.op_endpoint", "https://attacker.test"],
        ["openid.return_to", `${callback}&evil=1`],
        ["openid.signed", "claimed_id"],
        ["openid.response_nonce", "garbage"],
        ["openid.response_nonce", "2026-09-29T11:00:00Zfuture"],
        [
            "openid.identity",
            "https://steamcommunity.com/openid/id/76561198000000002",
        ],
    ]) {
        const input = assertion()
        input.set(key, value)
        await assert.rejects(verify(input, callback))
    }
    const duplicate = assertion()
    duplicate.append("openid.claimed_id", "attacker")
    await assert.rejects(verify(duplicate, callback))
})
test("invalid, redirected, oversized or stalled verification never returns a Steam identity", async () => {
    for (const response of [
        new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:false\n"),
        new Response(valid, { status: 302 }),
        new Response("x".repeat(9000)),
    ]) {
        await assert.rejects(
            createSteamVerifier(
                async () => response,
                () => now
            )(assertion(), callback)
        )
    }
    let aborted = false
    const verify = createSteamVerifier(
        async (_url, opts) =>
            new Promise((_resolve, reject) => {
                opts?.signal?.addEventListener("abort", () => {
                    aborted = true
                    reject(new Error("timeout"))
                })
            }),
        () => now,
        10
    )
    await assert.rejects(verify(assertion(), callback))
    assert.equal(aborted, true)
})
