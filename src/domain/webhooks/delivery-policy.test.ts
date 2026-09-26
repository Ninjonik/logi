import assert from "node:assert/strict"
import test from "node:test"

import {
    WEBHOOK_MAX_ATTEMPTS,
    shouldRetryWebhookDelivery,
} from "./delivery-policy"

test("webhook policy retries network, timeout, rate-limit, and server failures", () => {
    for (const status of [undefined, 408, 429, 500, 503])
        assert.equal(shouldRetryWebhookDelivery(status, 1), true)
})

test("webhook policy does not retry permanent client failures or exhaustion", () => {
    assert.equal(shouldRetryWebhookDelivery(400, 1), false)
    assert.equal(shouldRetryWebhookDelivery(404, 1), false)
    assert.equal(shouldRetryWebhookDelivery(500, WEBHOOK_MAX_ATTEMPTS), false)
})
