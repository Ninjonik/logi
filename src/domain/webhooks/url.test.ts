import assert from "node:assert/strict"
import test from "node:test"

import { validateWebhookUrl } from "./url"

test("webhook URLs reject credentials and private production hosts", () => {
    assert.equal(
        validateWebhookUrl("https://a:b@example.test", true),
        "Webhook URLs cannot contain credentials."
    )
    assert.equal(
        validateWebhookUrl("http://localhost/hook", true),
        "Webhook URLs must use HTTPS in production."
    )
    assert.equal(
        validateWebhookUrl("https://127.0.0.1/hook", true),
        "Webhook URLs cannot target a private network."
    )
    assert.equal(
        validateWebhookUrl("https://hooks.example.test/logi", true),
        null
    )
})
