import { eventWriteErrorMessage } from "./event-write-error"
import assert from "node:assert/strict"
import test from "node:test"

const messages = { forbidden: "Admins only.", fallback: "Unable to save." }

test("the access gate's bare forbidden code is localized; other errors pass through", () => {
    assert.equal(
        eventWriteErrorMessage({ error: "forbidden" }, messages),
        "Admins only."
    )
    assert.equal(
        eventWriteErrorMessage({ error: "Meeting time is invalid." }, messages),
        "Meeting time is invalid."
    )
    for (const body of [null, "forbidden", {}, { error: "" }, { error: 403 }])
        assert.equal(eventWriteErrorMessage(body, messages), "Unable to save.")
})
