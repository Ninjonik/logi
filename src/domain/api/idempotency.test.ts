import assert from "node:assert/strict"
import test from "node:test"

import { validateIdempotencyKey } from "./idempotency"

test("idempotency keys require a bounded visible value", () => {
    assert.equal(validateIdempotencyKey(null), "Idempotency-Key is required.")
    assert.equal(validateIdempotencyKey("ok-key"), null)
    assert.equal(
        validateIdempotencyKey("bad\nkey"),
        "Idempotency-Key must contain visible ASCII characters only."
    )
})
