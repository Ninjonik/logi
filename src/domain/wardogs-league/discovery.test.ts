import {
    indexDueForWorkspace,
    indexUrl,
    extractMatchUrls,
    matchesWatchedTeams,
    refreshIntervalMs,
    sharedScanIntervalMs,
    trackingDeadline,
    trackingSettingsSchema,
} from "./discovery"
import assert from "node:assert/strict"
import test from "node:test"

test("index URLs are exact allowlisted queries, never arbitrary pages", () => {
    assert.equal(
        indexUrl("https://wardogsleague.net/matches?tab=fixtures").id,
        "fixtures"
    )
    for (const url of [
        "http://wardogsleague.net/matches?tab=fixtures",
        "https://wardogsleague.net/matches?tab=fixtures&x=1",
        "https://wardogsleague.net/matches?tab=results#x",
        "https://wardogsleague.net.evil.test/matches?tab=fixtures",
        "https://wardogsleague.net/matches?tab=fixtures&tab=results",
    ])
        assert.throws(() => indexUrl(url))
})
test("message URLs are bounded and canonicalized without accepting requests or hostile suffixes", () => {
    assert.deepEqual(
        extractMatchUrls(
            "See <https://wardogsleague.net/matches/abc/> and https://wardogsleague.net/matches/abc. https://wardogsleague.net/matches/requests/no https://wardogsleague.net/matches/xyz?bad=1 https://wardogsleague.net.evil.test/matches/q"
        ),
        ["https://wardogsleague.net/matches/abc"]
    )
})
test("team matching uses exact canonical profiles and never matches VLK2", () => {
    assert.equal(
        matchesWatchedTeams(
            {
                teams: [
                    {
                        code: "VLK2",
                        profileUrl: "https://wardogsleague.net/teams/VLK2",
                    },
                ],
            },
            ["VLK"]
        ),
        false
    )
    assert.equal(
        matchesWatchedTeams(
            {
                teams: [
                    {
                        code: "VLK",
                        profileUrl: "https://wardogsleague.net/teams/VLK",
                    },
                ],
            },
            ["VLK"]
        ),
        true
    )
    assert.equal(
        matchesWatchedTeams(
            {
                teams: [
                    { code: "VLK", profileUrl: "https://evil.test/teams/VLK" },
                ],
            },
            ["VLK"]
        ),
        false
    )
})
test("refresh bounds use source start or first observation and settings require exact channels", () => {
    assert.equal(
        trackingDeadline({ scheduledAt: "2026-10-10T18:30:00Z" }, 0),
        Date.parse("2026-10-17T18:30:00Z")
    )
    assert.equal(
        trackingDeadline({ scheduledAt: null }, 100),
        14 * 86400000 + 100
    )
    assert.equal(
        trackingSettingsSchema.safeParse({
            enabled: true,
            teamCodes: ["VLK"],
            inputChannelId: null,
            outputChannelId: "bad",
        }).success,
        false
    )
})

test("cadence settings default to the historical 10/5 minutes and accept only offered values", () => {
    const parsed = trackingSettingsSchema.parse({
        enabled: true,
        teamCodes: ["VLK"],
        inputChannelId: null,
        outputChannelId: null,
    })
    assert.equal(parsed.scanMinutes, 10)
    assert.equal(parsed.refreshMinutes, 5)
    assert.ok(
        !trackingSettingsSchema.safeParse({ ...parsed, scanMinutes: 7 }).success
    )
    assert.ok(
        !trackingSettingsSchema.safeParse({ ...parsed, refreshMinutes: 1 })
            .success
    )
    assert.equal(refreshIntervalMs({ refreshMinutes: 15 }), 15 * 60_000)
    assert.equal(refreshIntervalMs(undefined), 5 * 60_000)
})

test("the shared scan follows the fastest enabled workspace and each workspace keeps its own cadence", () => {
    assert.equal(sharedScanIntervalMs([]), 10 * 60_000)
    assert.equal(
        sharedScanIntervalMs([
            { enabled: true, scanMinutes: 60 },
            { enabled: false, scanMinutes: 10 },
        ]),
        60 * 60_000
    )
    assert.equal(
        sharedScanIntervalMs([
            { enabled: true, scanMinutes: 30 },
            { enabled: true, scanMinutes: 15 },
        ]),
        15 * 60_000
    )
    const fetchedAt = Date.parse("2026-10-04T12:00:00.000Z")
    assert.ok(indexDueForWorkspace({ scanMinutes: 30 }, fetchedAt))
    assert.ok(
        !indexDueForWorkspace(
            { scanMinutes: 30, lastIndexAt: fetchedAt },
            fetchedAt
        )
    )
    assert.ok(
        !indexDueForWorkspace(
            { scanMinutes: 30, lastIndexAt: fetchedAt - 10 * 60_000 },
            fetchedAt
        )
    )
    assert.ok(
        indexDueForWorkspace(
            { scanMinutes: 30, lastIndexAt: fetchedAt - 30 * 60_000 + 10_000 },
            fetchedAt
        )
    )
    assert.ok(
        indexDueForWorkspace(
            { lastIndexAt: fetchedAt - 10 * 60_000 },
            fetchedAt
        )
    )
})
