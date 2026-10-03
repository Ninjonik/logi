import { canUseChannelType } from "./channel-types"
import assert from "node:assert/strict"
import test from "node:test"
test("private-thread parents accept text only while publications also allow announcement channels", () => {
    assert.equal(canUseChannelType("private-thread", 0), true)
    assert.equal(canUseChannelType("private-thread", 5), false)
    assert.equal(canUseChannelType("publication", 5), true)
    for (const type of [2, 4, 10, 11, 12, 13, 15])
        assert.equal(canUseChannelType("publication", type), false)
})
