import assert from "node:assert/strict"
import test from "node:test"

import {
    ssoApplicationUpdateSchema,
    ssoClientIdSchema,
} from "./sso-application"

const valid = {
    name: " Web klanu ",
    websiteUrl: "https://vas-klan.cz",
    redirectUris: ["https://vas-klan.cz/a", "https://vas-klan.cz/b"],
}

test("an application change keeps name, website and return addresses", () => {
    assert.deepEqual(ssoApplicationUpdateSchema.parse(valid), {
        ...valid,
        name: "Web klanu",
    })
})

test("an application change cannot touch the client or its secret", () => {
    assert.equal(
        ssoApplicationUpdateSchema.safeParse({ ...valid, clientSecret: "x" })
            .success,
        false
    )
    assert.equal(
        ssoApplicationUpdateSchema.safeParse({ ...valid, clientId: "x" })
            .success,
        false
    )
})

test("an application needs a name and one to ten return addresses", () => {
    for (const change of [
        { ...valid, name: "  " },
        { ...valid, name: "x".repeat(101) },
        { ...valid, redirectUris: [] },
        { ...valid, redirectUris: Array(11).fill("https://a.example") },
        { ...valid, websiteUrl: "" },
    ])
        assert.equal(
            ssoApplicationUpdateSchema.safeParse(change).success,
            false
        )
})

test("only client IDs Logi issues are accepted", () => {
    assert.ok(ssoClientIdSchema.safeParse(`logi_${"a".repeat(24)}`).success)
    assert.equal(ssoClientIdSchema.safeParse("logi_short").success, false)
    assert.equal(
        ssoClientIdSchema.safeParse(`../logi_${"a".repeat(24)}`).success,
        false
    )
})
