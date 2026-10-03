import {
    indexUrl,
    extractMatchUrls,
    matchesWatchedTeams,
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
