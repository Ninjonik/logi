import assert from "node:assert/strict"
import test from "node:test"

import { hashSsoValue, isExactHttpsUrl, verifyPkceS256 } from "./sso"

test("SSO only accepts exact HTTPS callback URLs", () => {
    assert.equal(isExactHttpsUrl("https://example.com/callback"), true)
    assert.equal(isExactHttpsUrl("http://example.com/callback"), false)
    assert.equal(isExactHttpsUrl("https://user@example.com/callback"), false)
    assert.equal(
        isExactHttpsUrl("https://example.com/callback#fragment"),
        false
    )
})

test("SSO validates PKCE S256 verifiers", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    assert.equal(verifyPkceS256(verifier, challenge), true)
    assert.equal(verifyPkceS256(verifier, hashSsoValue(verifier)), false)
    for (const invalid of ["", "short", "x".repeat(129), "!".repeat(43)])
        assert.equal(verifyPkceS256(invalid, challenge), false)
    assert.equal(verifyPkceS256("x".repeat(43), challenge), false)
    assert.equal(verifyPkceS256(verifier, "short"), false)
})
