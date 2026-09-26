import assert from "node:assert/strict"
import test from "node:test"

import { signWebhookPayload } from "./signature"

test("webhook signatures use sha256 HMAC over timestamp, dot, and raw body", () => {
    assert.equal(
        signWebhookPayload("1700000000", '{"id":"delivery-1"}', "secret"),
        "sha256=7fa8b874bca4a726954e6895d4de6301113f33bc18470601b6281c4c72409f2d"
    )
})
