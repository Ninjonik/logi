import { walkthroughSteps, walkHref, matchesWalkRoute } from "./walkthrough"
import assert from "node:assert/strict"
import { test } from "node:test"

test("manager tour navigates player records and every production match stage", () => {
    const steps = walkthroughSteps("manager", true)
    assert.equal(new Set(steps.map((s) => s.id)).size, steps.length)
    assert.equal(steps.find((s) => s.id === "players-nav")?.action, "advance")
    assert.equal(steps.find((s) => s.id === "player-trends")?.mock, "profile")
    assert.deepEqual(
        [
            ...new Set(
                steps.filter((s) => s.mock === "match").map((s) => s.formStep)
            ),
        ],
        ["match", "time", "signups", "discord", "review"]
    )
    assert.equal(steps.find((s) => s.id === "match-publish")?.action, "advance")
})
test("limited and member tours never enter match creation", () => {
    for (const kind of [
        "competitions",
        "member",
        "competition-member",
    ] as const) {
        const steps = walkthroughSteps(kind, false)
        assert.ok(steps.every((s) => s.mock !== "match" && s.chapter !== "bot"))
    }
})
test("route matching ignores query and fragment but not route boundaries", () => {
    const step = walkthroughSteps("manager", true).find(
        (s) => s.id === "match-watch"
    )!
    assert.equal(
        walkHref("cs", "clan", step),
        "/cs/dashboard/servers/clan/matches/create?game=wardogs"
    )
    assert.ok(
        matchesWalkRoute(
            "/cs/dashboard/servers/clan/matches/create",
            walkHref("cs", "clan", step)
        )
    )
    assert.ok(
        !matchesWalkRoute(
            "/cs/dashboard/servers/clan/matches",
            walkHref("cs", "clan", step)
        )
    )
})

test("every role and mode uses local examples on every tour step", () => {
    for (const kind of [
        "welcome",
        "manager",
        "competitions",
        "member",
        "competition-member",
    ] as const) {
        for (const botInside of [true, false]) {
            assert.ok(
                walkthroughSteps(kind, botInside).every((step) =>
                    ["section", "players", "profile", "match"].includes(
                        step.mock
                    )
                )
            )
        }
    }
})
