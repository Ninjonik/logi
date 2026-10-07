import assert from "node:assert/strict"
import test from "node:test"

import { chooseDashboardLanding } from "./dashboard-landing"

const visible = new Set(["clan-a", "clan-b"])

test("opens the stored default when the person can still see it", () => {
    assert.deepEqual(
        chooseDashboardLanding({
            showClanList: false,
            visibleWorkspaceIds: visible,
            candidates: ["clan-b"],
        }),
        { kind: "workspace", workspaceId: "clan-b" }
    )
})

test("a stale default falls through to the next visible candidate", () => {
    assert.deepEqual(
        chooseDashboardLanding({
            showClanList: false,
            visibleWorkspaceIds: visible,
            candidates: ["clan-gone", null, "clan-a"],
        }),
        { kind: "workspace", workspaceId: "clan-a" }
    )
})

test("no visible candidate shows the clan list instead of redirecting", () => {
    assert.deepEqual(
        chooseDashboardLanding({
            showClanList: false,
            visibleWorkspaceIds: visible,
            candidates: ["clan-gone", undefined],
        }),
        { kind: "clanList" }
    )
    assert.deepEqual(
        chooseDashboardLanding({
            showClanList: false,
            visibleWorkspaceIds: new Set(),
            candidates: [],
        }),
        { kind: "clanList" }
    )
})

test("asking for the clan list never redirects", () => {
    assert.deepEqual(
        chooseDashboardLanding({
            showClanList: true,
            visibleWorkspaceIds: visible,
            candidates: ["clan-a"],
        }),
        { kind: "clanList" }
    )
})
