import assert from "node:assert/strict"
import test from "node:test"

import {
    clientGrantScopes,
    decodeClientGrantClaims,
    encodeClientGrantClaims,
    splitClientGrant,
} from "./client-grant"

test("claims round-trip through the URL-safe payload", () => {
    const claims = {
        sub: "111111111111111111",
        scope: clientGrantScopes.roster("guilds:a", "rosters:b"),
        exp: 1_800_000_000_000,
    }
    const payload = encodeClientGrantClaims(claims)
    assert.match(payload, /^[A-Za-z0-9_-]+$/)
    assert.deepEqual(decodeClientGrantClaims(payload), claims)
})

test("malformed claims are rejected", () => {
    const encode = (value: unknown) =>
        btoa(JSON.stringify(value)).replace(/=+$/, "")
    for (const payload of [
        "not base64!",
        encode({ sub: "abc", scope: "x", exp: 1 }),
        encode({ sub: "1", scope: "", exp: 1 }),
        encode({ sub: "1", scope: "x", exp: "soon" }),
        encode(["1", "x", 1]),
    ])
        assert.equal(decodeClientGrantClaims(payload), null)
})

test("a grant has exactly a payload and a 32-byte signature", () => {
    const signature = "A".repeat(43)
    assert.deepEqual(splitClientGrant(`abc.${signature}`), {
        payload: "abc",
        signature,
    })
    assert.equal(splitClientGrant(`abc.${signature}.extra`), null)
    assert.equal(splitClientGrant(`abc.short`), null)
    assert.equal(splitClientGrant(`.${signature}`), null)
})

test("scopes name one resource each", () => {
    assert.equal(clientGrantScopes.stratmap("s1"), "stratmap:s1")
    assert.equal(clientGrantScopes.stratmapCreate("g1"), "stratmaps:g1")
    assert.notEqual(
        clientGrantScopes.roster("g1", "r1"),
        clientGrantScopes.roster("g1", "r2")
    )
})
