import assert from "node:assert/strict"
import test from "node:test"

import {
    localeOfPath,
    loginErrorPath,
    loginPath,
    parseLoginError,
} from "@/lib/login-redirect"

test("the login error keeps the language the sign-in started from", () => {
    assert.equal(
        loginErrorPath("/cs/dashboard", "oauth-state"),
        "/cs/login?error=oauth-state&redirectTo=%2Fcs%2Fdashboard"
    )
    assert.equal(
        loginErrorPath("/de/dashboard/servers/abc?tab=1", "discord-login"),
        "/de/login?error=discord-login&redirectTo=%2Fde%2Fdashboard%2Fservers%2Fabc%3Ftab%3D1"
    )
})

test("paths without a known locale fall back to the default", () => {
    assert.equal(localeOfPath("/fr/dashboard"), "en")
    assert.equal(localeOfPath("/"), "en")
    assert.equal(localeOfPath("/cs"), "cs")
    assert.equal(localeOfPath("/cs?x=1"), "cs")
    assert.equal(
        loginErrorPath("/wiki", "oauth-state"),
        "/en/login?error=oauth-state&redirectTo=%2Fwiki"
    )
})

test("only known error codes are explained", () => {
    assert.equal(parseLoginError("oauth-state"), "oauth-state")
    assert.equal(parseLoginError("discord-login"), "discord-login")
    assert.equal(parseLoginError("<script>"), null)
    assert.equal(parseLoginError(["oauth-state"]), null)
    assert.equal(parseLoginError(undefined), null)
})

test("login destinations preserve dashboard entry and exact protected URLs", () => {
    for (const destination of [
        "/en/dashboard",
        "/cs/dashboard/servers/abc/events?game=hll&tab=upcoming",
        "/pl/league-teams?invite=abc",
    ]) {
        const url = new URL(loginPath(destination), "https://logi.example")
        assert.equal(url.pathname, `/${localeOfPath(destination)}/login`)
        assert.equal(url.searchParams.get("redirectTo"), destination)
    }
})
