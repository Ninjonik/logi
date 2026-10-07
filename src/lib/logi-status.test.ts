import assert from "node:assert/strict"
import test from "node:test"

import { overallLogiStatus } from "@/lib/logi-status"

test("the overall status follows the monitored services", () => {
    assert.equal(overallLogiStatus(null), "unknown")
    assert.equal(overallLogiStatus([]), "unknown")
    assert.equal(
        overallLogiStatus([{ online: true }, { online: true }]),
        "operational"
    )
    assert.equal(
        overallLogiStatus([{ online: true }, { online: false }]),
        "degraded"
    )
})
