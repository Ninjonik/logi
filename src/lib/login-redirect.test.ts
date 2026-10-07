import assert from "node:assert/strict"
import test from "node:test"

import {
    localeOfPath,
    loginErrorPath,
    parseLoginError,
} from "@/lib/login-redirect"

test("the login error keeps the language the sign-in started from", () => {
    assert.equal(
        loginErrorPath("/cs/dashboard", "oauth-state"),
        "/cs/login?error=oauth-state"
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
