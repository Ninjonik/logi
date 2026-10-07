import {
    CHANGE_RETENTION_MS,
    FEED_RESOURCES,
    RETIRED_SYNC_RESOURCES,
    SYNC_RESOURCES,
    nextRevision,
    readsChangeFeed,
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
test("changes and tombstones are retained two days", () => {
    assert.equal(CHANGE_RETENTION_MS, 2 * 24 * 60 * 60 * 1000)
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
test("only a live key granted a feed resource, or an event-command key, reads the feed", () => {
    const grant = (resources: string[]) => ({
        resources,
        gameIds: ["wardogs"],
    })
    assert.equal(readsChangeFeed({ readAccess: grant(["teams"]) }), true)
    assert.equal(
        readsChangeFeed({ readAccess: grant(["membership-summaries"]) }),
        true
    )
    for (const key of [
        {},
        { readAccess: grant(["server-snapshots", "integration-health"]) },
        { readAccess: grant(["events", "hll-live"]) },
        { readAccess: grant(["event-summaries"]), revokedAt: "2026-10-07" },
        { readAccess: { resources: ["event-summaries"] } },
        { writeAccess: { resources: ["event-commands"] } },
    ])
        assert.equal(readsChangeFeed(key), false, JSON.stringify(key))
    assert.equal(
        readsChangeFeed({
            readAccess: grant(["events"]),
            writeAccess: {
                resources: ["event-commands"],
                gameIds: ["wardogs"],
            },
        }),
        true,
        "event commands compare against the event-summaries revision"
    )
})
