import {
    HISTORY_RETENTION_MS,
    LEAGUE_MESSAGE_REF_TTL_MS,
    REQUEST_RETENTION_MS,
    leagueMessageRefExpiry,
    matchHistoryExpired,
    retentionCutoffs,
    seedCallPending,
} from "./retention"
import assert from "node:assert/strict"
import test from "node:test"

const DAY = 24 * 60 * 60 * 1000
const now = Date.parse("2026-10-07T04:05:00.000Z")

test("history is kept 30 days, expired requests a day, League message references 14 days", () => {
    assert.equal(HISTORY_RETENTION_MS, 30 * DAY)
    assert.equal(REQUEST_RETENTION_MS, DAY)
    assert.equal(LEAGUE_MESSAGE_REF_TTL_MS, 14 * DAY)
    assert.deepEqual(retentionCutoffs(now), {
        history: now - 30 * DAY,
        historyIso: "2026-09-07T04:05:00.000Z",
        request: now - DAY,
        requestIso: "2026-10-06T04:05:00.000Z",
        leagueMessageRef: now - 14 * DAY,
    })
    assert.equal(leagueMessageRefExpiry(now), now + 14 * DAY)
})

test("a match's preparation rows go only once the match is gone or ended before the window", () => {
    const cutoff = retentionCutoffs(now).history
    assert.equal(matchHistoryExpired(null, cutoff), true)
    assert.equal(
        matchHistoryExpired({ gameEnd: "2026-09-01T20:00:00.000Z" }, cutoff),
        true
    )
    // Ended inside the window, or still ahead: an old sign-up dates a player
    // on the list and the first digest stays the baseline.
    assert.equal(
        matchHistoryExpired({ gameEnd: "2026-09-20T20:00:00.000Z" }, cutoff),
        false
    )
    assert.equal(
        matchHistoryExpired({ gameEnd: "2026-11-20T20:00:00.000Z" }, cutoff),
        false
    )
    assert.equal(matchHistoryExpired({ gameEnd: "not a time" }, cutoff), false)
})

test("a seed call is pending while its request revision is ahead of the delivered one", () => {
    assert.equal(seedCallPending(null), false)
    assert.equal(seedCallPending({ revision: 3, deliveredRevision: 3 }), false)
    assert.equal(seedCallPending({ revision: 4, deliveredRevision: 3 }), true)
})
