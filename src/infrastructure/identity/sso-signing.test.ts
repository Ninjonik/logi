import { isSsoCallback } from "../../domain/identity/sso-policy"
import { configureSsoSigning } from "./sso-signing"
import { generateKeyPair, exportJWK } from "jose"
import assert from "node:assert/strict"
import { test } from "node:test"

test("loopback development mode never enables arbitrary HTTP origins or fragments", () => {
    for (const valid of [
        "http://localhost:30162/callback",
        "http://127.0.0.1:30162/callback",
        "http://[::1]:30162/callback",
    ]) {
        assert.equal(isSsoCallback(valid), false)
        assert.equal(isSsoCallback(valid, true), true)
    }
    for (const invalid of [
        "http://example.com/callback",
        "https://*.example.com/callback",
        "https://%2a.example.com/callback",
        "http://localhost.example.com/callback",
        "https://example.com/callback#",
        "https://example.com\n/callback",
    ])
        assert.equal(isSsoCallback(invalid, true), false)
})
test("invalid issuer and signing keys cannot enable the provider", async () => {
    const { privateKey } = await generateKeyPair("RS256", { extractable: true })
    const jwk = { ...(await exportJWK(privateKey)), kid: "test-key" }
    const env = {
        issuer: "https://provider.invalid",
        privateJwk: JSON.stringify(jwk),
        allowLoopbackHttp: false,
    }
    for (const issuer of [
        "http://provider.invalid",
        "https://provider.invalid/",
        "https://provider.invalid/path",
        "https://user@provider.invalid",
    ])
        await assert.rejects(configureSsoSigning({ ...env, issuer }))
    for (const key of [
        { ...jwk, d: undefined },
        { ...jwk, kid: undefined },
        { ...jwk, alg: "HS256" },
        { ...jwk, n: "abcd" },
        { kty: "oct", k: "abc" },
    ])
        await assert.rejects(
            configureSsoSigning({ ...env, privateJwk: JSON.stringify(key) })
        )
    assert.equal((await configureSsoSigning(env)).issuer, env.issuer)
})
