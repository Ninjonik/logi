import assert from "node:assert/strict"
import test from "node:test"

import {
    globalAdminSection,
    pendingBadgeLabel,
} from "@/lib/navigation/global-admin-routes"

test("global administration pages are recognised in every locale", () => {
    assert.equal(globalAdminSection("/cs/dashboard/teams"), "teams")
    assert.equal(
        globalAdminSection("/en/dashboard/competitions/abc123"),
        "competitions"
    )
    assert.equal(
        globalAdminSection("/de/dashboard/team-requests"),
        "team-requests"
    )
    assert.equal(globalAdminSection("/en/dashboard/bot?level=ERROR"), "bot")
    assert.equal(
        globalAdminSection("/en/dashboard/platform-settings"),
        "platform-settings"
    )
})

test("clan pages and the rest of the dashboard are not global administration", () => {
    assert.equal(globalAdminSection("/cs/dashboard"), null)
    assert.equal(globalAdminSection("/cs/dashboard/servers/abc/teams"), null)
    assert.equal(globalAdminSection("/cs/dashboard/logicomms"), null)
    assert.equal(globalAdminSection("/cs/competitions"), null)
    assert.equal(globalAdminSection(null), null)
})

test("the pending badge hides at zero and caps a full page", () => {
    assert.equal(pendingBadgeLabel(0, false), null)
    assert.equal(pendingBadgeLabel(3, false), "3")
    assert.equal(pendingBadgeLabel(50, true), "50+")
})
