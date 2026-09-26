import assert from "node:assert/strict"
import test from "node:test"

import { GET } from "@/app/api/v1/clan/[[...path]]/route"

test("clan route rejects missing and malformed credentials through HTTP", async () => {
    for (const authorization of [undefined, "Basic value", "Bearer "]) {
        const response = await GET(
            new Request("https://logi.test/api/v1/clan/events", {
                ...(authorization ? { headers: { authorization } } : {}),
            }),
            { params: Promise.resolve({ path: ["events"] }) }
        )

        assert.equal(response.status, 401)
        assert.deepEqual(await response.json(), {
            error: {
                code: "missing_api_key",
                message: "Use Authorization: Bearer <API key>.",
            },
        })
    }
})
