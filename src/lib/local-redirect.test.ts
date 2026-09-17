import assert from "node:assert/strict"
import test from "node:test"

import { sanitizeLocalRedirect } from "./local-redirect"

test("keeps a local dashboard path including its query string", () => {
    assert.equal(
        sanitizeLocalRedirect(
            "/en/dashboard/servers/abc/events?game=wardogs",
            "/en/dashboard"
        ),
        "/en/dashboard/servers/abc/events?game=wardogs"
    )
})

test("falls back instead of accepting an external redirect", () => {
    for (const redirect of [
        "https://example.com",
        "//example.com",
        "/\\example.com",
    ]) {
        assert.equal(
            sanitizeLocalRedirect(redirect, "/en/dashboard"),
            "/en/dashboard"
        )
    }
})
