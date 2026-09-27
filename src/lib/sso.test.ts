import assert from "node:assert/strict"
import test from "node:test"

import { hashSsoValue, isExactHttpsUrl, verifyPkceS256 } from "./sso"

test("SSO only accepts exact HTTPS callback URLs", () => {
    assert.equal(isExactHttpsUrl("https://example.com/callback"), true)
    assert.equal(isExactHttpsUrl("http://example.com/callback"), false)
    assert.equal(isExactHttpsUrl("https://user@example.com/callback"), false)
})

test("SSO validates PKCE S256 verifiers", () => {
    const verifier = "verifier"
    assert.equal(verifyPkceS256(verifier, hashSsoValue(verifier)), true)
    assert.equal(verifyPkceS256("wrong", hashSsoValue(verifier)), false)
})
