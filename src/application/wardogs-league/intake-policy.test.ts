import { acceptMessageVersion } from "./intake-policy"
import assert from "node:assert/strict"
import test from "node:test"
test("message edits cannot replay old content or resurrect a deleted reference", () => {
    assert.equal(acceptMessageVersion({ version: 20 }, 10, false), false)
    assert.equal(acceptMessageVersion({ version: 20 }, 20, false), false)
    assert.equal(acceptMessageVersion({ version: 20 }, 21, false), true)
    assert.equal(acceptMessageVersion({ version: 20 }, 20, true), true)
    assert.equal(
        acceptMessageVersion({ version: 21, deleted: true }, 22, false),
        false
    )
    assert.equal(acceptMessageVersion(null, Infinity, false), false)
})
