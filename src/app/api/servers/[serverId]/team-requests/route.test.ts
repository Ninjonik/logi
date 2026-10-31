import assert from "node:assert/strict"
import { GET, POST } from "./route"
import test from "node:test"
test("workspace team requests are retired in favor of immediate team profile management", async () => {
    for (const handler of [GET, POST]) {
        const response = handler()
        assert.equal(response.status, 410)
        assert.equal(response.headers.get("cache-control"), "no-store")
        assert.deepEqual(await response.json(), {
            error: "team_requests_retired",
        })
    }
})
