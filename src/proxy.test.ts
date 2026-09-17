import assert from "node:assert/strict"
import test from "node:test"

import { NextRequest } from "next/server"

import proxy from "./proxy"

test("sends an unsigned dashboard visit through login and back to its exact URL", async () => {
    const response = await proxy(
        new NextRequest(
            "https://logi.example/en/dashboard/servers/workspace/events?game=wardogs"
        )
    )

    assert.ok(response)
    const location = new URL(response.headers.get("location") ?? "")
    assert.equal(location.pathname, "/en/login")
    assert.equal(
        location.searchParams.get("redirectTo"),
        "/en/dashboard/servers/workspace/events?game=wardogs"
    )
})
