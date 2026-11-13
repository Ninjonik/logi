import {
    convex,
    references,
    closeConvexClient,
    shutdownConvexClient,
} from "./convex"
import { ConvexReactClient } from "convex/react"
import assert from "node:assert/strict"
import test from "node:test"

test("final shutdown prevents a late callback from recreating the Convex client", async (t) => {
    let reads = 0
    t.mock.method(ConvexReactClient.prototype, "query", async () => {
        reads++
        return null
    })
    await convex.query(references.listPendingManualReminders, {
        secret: "synthetic",
    })
    await closeConvexClient()
    // A reusable disconnect is distinct from final process shutdown.
    await convex.query(references.listPendingManualReminders, {
        secret: "synthetic",
    })
    assert.equal(reads, 2)
    await shutdownConvexClient()
    assert.throws(
        () =>
            convex.query(references.listPendingManualReminders, {
                secret: "synthetic",
            }),
        /client is closed/
    )
    assert.equal(reads, 2)
})
