import { canPublishChannel } from "./channel-permissions"
import assert from "node:assert/strict"
import test from "node:test"
test("channel deny beats guild role permissions and member allow beats role deny", () => {
    const role = { id: "g", permissions: "117760" }
    assert.equal(canPublishChannel("g", "bot", [], [role], []), true)
    const deny = { id: "g", type: 0, allow: "0", deny: "2048" }
    assert.equal(canPublishChannel("g", "bot", [], [role], [deny]), false)
    assert.equal(
        canPublishChannel(
            "g",
            "bot",
            [],
            [role],
            [deny, { id: "bot", type: 1, allow: "2048", deny: "0" }]
        ),
        true
    )
})
