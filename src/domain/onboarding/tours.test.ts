import {
    nextTour,
    tourKey,
    tourChapters,
    parseBookmark,
    chapterPath,
    type TourContext,
} from "./tours"
import assert from "node:assert/strict"
import test from "node:test"
const admin: TourContext = {
    workspaceId: "clan-a",
    canManage: true,
    limited: false,
    botInside: false,
}
test("first login is account scoped and followed by the clan manager tour", () => {
    assert.equal(nextTour(admin, new Set()), "welcome")
    assert.equal(nextTour(admin, new Set([tourKey("welcome")])), "manager")
    assert.equal(
        nextTour(
            { ...admin, workspaceId: undefined },
            new Set([tourKey("welcome")])
        ),
        null
    )
})
test("member completion does not consume admin, limited or another clan's tour", () => {
    const seen = new Set([
        tourKey("welcome"),
        tourKey("member", "clan-a"),
        tourKey("manager", "clan-b"),
    ])
    assert.equal(nextTour(admin, seen), "manager")
    seen.add(tourKey("manager", "clan-a"))
    assert.equal(nextTour(admin, seen), null)
    assert.equal(nextTour({ ...admin, limited: true }, seen), "competitions")
    assert.equal(nextTour({ ...admin, workspaceId: "clan-c" }, seen), "manager")
})
test("limited members are not shown admin-only pages or full-clan automation", () => {
    assert.equal(
        nextTour(
            { ...admin, limited: true, canManage: false },
            new Set([tourKey("welcome")])
        ),
        "competition-member"
    )
    const limited = tourChapters("competitions", false)
    assert.ok(
        limited.includes("players") &&
            limited.includes("teams") &&
            limited.includes("competitions")
    )
    for (const id of [
        "match",
        "bot",
        "roster",
        "seeding",
        "membership",
        "servers",
    ] as const)
        assert.ok(!limited.includes(id))
    assert.deepEqual(tourChapters("competition-member", false), [
        "overview",
        "account",
        "finish",
    ])
})
test("the full manager catalogue covers operations, people, Discord and integrations", () => {
    const full = tourChapters("manager", false)
    assert.equal(new Set(full).size, full.length)
    for (const id of [
        "bot",
        "players",
        "performance",
        "match",
        "signups",
        "roster",
        "attendance",
        "results",
        "history",
        "tracking",
        "commands",
        "training",
        "calendar",
        "presets",
        "maps",
        "articles",
        "membership",
        "tickets",
        "competitions",
        "teams",
        "panels",
        "seeding",
        "servers",
        "integrations",
    ] as const)
        assert.ok(full.includes(id), id)
    assert.ok(!tourChapters("manager", true).includes("bot"))
})
test("bad, stale or foreign bookmarks cannot select a chapter or route", () => {
    const chapters = tourChapters("member", true)
    for (const raw of [
        null,
        "bad",
        "null",
        "{}",
        '{"step":"settings","status":"active"}',
        '{"step":"account","status":"other"}',
    ])
        assert.equal(parseBookmark(raw, chapters), null)
    assert.deepEqual(
        parseBookmark('{"step":"account","status":"active"}', chapters),
        { step: "account", status: "active" }
    )
    assert.equal(chapterPath("players"), "/users")
    assert.equal(chapterPath("welcome"), null)
})

test("first login includes bot installation when an admin has an unconnected full clan", () => {
    assert.ok(tourChapters("welcome", false).includes("bot"))
    assert.ok(!tourChapters("welcome", true).includes("bot"))
})
