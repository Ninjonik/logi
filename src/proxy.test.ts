import assert from "node:assert/strict"
import test from "node:test"

import { NextRequest } from "next/server"

import { EXTERNAL_API_REQUESTS_PER_SECOND } from "./lib/api/external-api-rate-limit"
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

test("applies the clan API ceiling by bearer key across client IPs", async () => {
    const request = new NextRequest("https://logi.example/api/v1/clan/events", {
        headers: {
            authorization: "Bearer integration-key",
            "x-forwarded-for": "203.0.113.10",
        },
    })
    for (let count = 0; count < EXTERNAL_API_REQUESTS_PER_SECOND; count++)
        assert.equal(await proxy(request), undefined)

    const response = await proxy(request)
    assert.ok(response)
    assert.equal(response.status, 429)
    assert.equal(response.headers.get("RateLimit-Limit"), "60")
    assert.equal(response.headers.get("RateLimit-Remaining"), "0")
    assert.match(response.headers.get("Retry-After") ?? "", /^[1-9]\d*$/)

    const secondIpResponse = await proxy(
        new NextRequest("https://logi.example/api/v1/clan/events", {
            headers: {
                authorization: "Bearer integration-key",
                "x-forwarded-for": "203.0.113.11",
            },
        })
    )
    assert.ok(secondIpResponse)
    assert.equal(secondIpResponse.status, 429)
})

for (const locale of ["en", "cs", "de", "pl"]) {
    test(`preserves ${locale} dashboard URLs when a session cookie needs server validation`, async () => {
        const path = `/${locale}/dashboard/servers/workspace/events?game=wardogs&tab=upcoming`
        const response = await proxy(
            new NextRequest(`https://logi.example${path}`, {
                headers: {
                    cookie: "token=expired-session",
                    "x-logi-request-path": "/en/untrusted",
                },
            })
        )
        assert.ok(response)
        assert.equal(
            response.headers.get("x-middleware-request-x-logi-request-path"),
            path
        )
    })
}
