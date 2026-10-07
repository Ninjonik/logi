import assert from "node:assert/strict"
import test from "node:test"

import { globalAdminHref, isGlobalAdminPath } from "./global-admin-routes"

test("global administration pages are recognised in every locale", () => {
    assert.equal(isGlobalAdminPath("/cs/dashboard/teams"), true)
    assert.equal(isGlobalAdminPath("/en/dashboard/competitions/abc"), true)
    assert.equal(isGlobalAdminPath("/de/dashboard/team-requests"), true)
    assert.equal(isGlobalAdminPath("/en/dashboard/platform-settings"), true)
})

test("clan pages and look-alike paths are not global administration", () => {
    assert.equal(isGlobalAdminPath("/en/dashboard"), false)
    assert.equal(isGlobalAdminPath("/en/dashboard/servers/x/teams"), false)
    assert.equal(isGlobalAdminPath("/en/dashboard/teams-old"), false)
    assert.equal(isGlobalAdminPath("/en/dashboard/settings/user"), false)
    assert.equal(isGlobalAdminPath(null), false)
})

test("links keep the optional workspace query", () => {
    assert.equal(
        globalAdminHref("cs", "teams", "?workspace=w1"),
        "/cs/dashboard/teams?workspace=w1"
    )
})
