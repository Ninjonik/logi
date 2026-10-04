import { nextRevision, revisionOrder } from "./change"
import assert from "node:assert/strict"
import test from "node:test"

test("revision order is lossless across 9/10 and the Number boundary", () => {
    assert.ok(revisionOrder("9") < revisionOrder("10"))
    assert.equal(nextRevision("9007199254740992"), "9007199254740993")
    assert.ok(
        revisionOrder("9007199254740992") < revisionOrder("9007199254740993")
    )
})
test("only canonical bounded decimal revisions are accepted", () => {
    for (const value of ["01", "-1", "1.0", "", "1e5", "9".repeat(129)])
        assert.throws(() => revisionOrder(value))
    assert.throws(() => nextRevision("9".repeat(128)))
    assert.equal(nextRevision("0"), "1")
})
