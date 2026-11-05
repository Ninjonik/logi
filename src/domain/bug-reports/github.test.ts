import { verifyGithubSignature } from "../../infrastructure/github/webhook"
import { githubState, reportState, issueBody } from "./github"
import { createHmac } from "node:crypto"
import assert from "node:assert/strict"
import { test } from "node:test"
test("status mapping preserves investigating and reopens resolved reports", () => {
    assert.equal(githubState("resolved"), "closed")
    assert.equal(githubState("investigating"), "open")
    assert.equal(reportState("open", "investigating"), "investigating")
    assert.equal(reportState("open", "resolved"), "new")
    assert.equal(reportState("closed", "new"), "resolved")
})
test("issue body has recovery marker and excludes private report identity", () => {
    const body = issueBody({
        _id: "id",
        message: "Details",
        server: "",
        occurredAt: undefined,
    })
    assert.ok(body.startsWith("<!-- logi-report:id -->"))
    assert.ok(body.includes("Details"))
})
test("signature authenticates exact bytes and rejects malformed signatures", () => {
    const body = '{"hello":"world"}'
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`
    assert.ok(verifyGithubSignature(body, signature, "secret"))
    assert.equal(verifyGithubSignature(body + " ", signature, "secret"), false)
    for (const value of [null, "", "sha256=bad", "sha1=" + "a".repeat(64)])
        assert.equal(verifyGithubSignature(body, value, "secret"), false)
})
