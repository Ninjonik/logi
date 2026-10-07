import {
    FEED_RESOURCES,
    RETIRED_SYNC_RESOURCES,
    SYNC_RESOURCES,
    nextRevision,
    revisionOrder,
} from "./change"
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
test("live state is accepted by the feed but never appended", () => {
    assert.ok(SYNC_RESOURCES.includes("server-snapshots"))
    assert.ok(SYNC_RESOURCES.includes("integration-health"))
    assert.deepEqual(
        FEED_RESOURCES.filter((resource) =>
            (RETIRED_SYNC_RESOURCES as readonly string[]).includes(resource)
        ),
        []
    )
    assert.equal(
        FEED_RESOURCES.length + RETIRED_SYNC_RESOURCES.length,
        SYNC_RESOURCES.length
    )
})
