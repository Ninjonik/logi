import assert from "node:assert/strict"
import test from "node:test"

import {
    CLAN_META_INTERVAL_MS,
    clanMetaFreshness,
    projectClanMetaCounts,
    tallyClanMeta,
} from "./clan-meta"

const now = Date.parse("2026-10-06T10:00:00.000Z")

test("a clan without a summary is missing; an unreadable time is stale", () => {
    assert.equal(clanMetaFreshness(undefined, now), "missing")
    assert.equal(clanMetaFreshness(null, now), "missing")
    assert.equal(clanMetaFreshness("", now), "missing")
    assert.equal(clanMetaFreshness("not a date", now), "stale")
})

test("a summary is fresh for one interval and stale from the interval on", () => {
    const recent = new Date(now - CLAN_META_INTERVAL_MS + 1).toISOString()
    assert.equal(clanMetaFreshness(recent, now), "fresh")
    const old = new Date(now - CLAN_META_INTERVAL_MS).toISOString()
    assert.equal(clanMetaFreshness(old, now), "stale")
    assert.equal(
        clanMetaFreshness(old, now, CLAN_META_INTERVAL_MS + 1),
        "fresh"
    )
})

test("the tallies count distinct assigned people and keep the other tallies", () => {
    const tallies = tallyClanMeta({
        events: 3,
        groups: 2,
        rosters: 1,
        assignments: [{ userId: "a" }, { userId: "b" }, { userId: "a" }],
        calendarItems: 4,
        stratmaps: 5,
        topicPresets: 6,
        squadPresets: 7,
        matches: 8,
        articles: 9,
        apiKeys: 10,
    })
    assert.deepEqual(tallies, {
        events: 3,
        groups: 2,
        rosters: 1,
        assignments: 3,
        users: 2,
        calendarItems: 4,
        stratmaps: 5,
        topicPresets: 6,
        squadPresets: 7,
        matches: 8,
        articles: 9,
        apiKeys: 10,
    })
})

test("the counts keep the endpoint's resource keys and a settings count of one", () => {
    assert.deepEqual(
        projectClanMetaCounts({
            events: 3,
            groups: 2,
            rosters: 1,
            assignments: 3,
            users: 2,
            calendarItems: 4,
            stratmaps: 5,
            topicPresets: 6,
            squadPresets: 7,
            matches: 8,
            articles: 9,
            apiKeys: 10,
        }),
        {
            events: 3,
            groups: 2,
            rosters: 1,
            assignments: 3,
            users: 2,
            "calendar-items": 4,
            stratmaps: 5,
            "topic-presets": 6,
            "squad-presets": 7,
            matches: 8,
            articles: 9,
            settings: 1,
            "api-keys": 10,
        }
    )
})
