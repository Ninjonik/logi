import {
    historyGameExpired,
    historyRetentionCutoff,
    historyRetentionSettingsSchema,
} from "./history-retention"
import assert from "node:assert/strict"
import test from "node:test"

const now = Date.parse("2026-10-04T12:00:00.000Z")

test("indefinite retention never produces a cutoff", () => {
    assert.equal(historyRetentionCutoff(null, now), null)
    assert.equal(historyRetentionCutoff(undefined, now), null)
    assert.equal(historyRetentionCutoff({ retentionDays: null }, now), null)
})

test("a retention window cuts off games that ended before it, by UTC instant", () => {
    const cutoff = historyRetentionCutoff({ retentionDays: 90 }, now)
    assert.equal(cutoff, "2026-07-06T12:00:00.000Z")
    assert.ok(historyGameExpired("2026-07-06T11:59:59.000Z", cutoff!))
    assert.ok(!historyGameExpired("2026-07-06T12:00:00.000Z", cutoff!))
    assert.ok(!historyGameExpired("2026-10-03T20:00:00.000Z", cutoff!))
})

test("only the offered retention windows are accepted", () => {
    for (const retentionDays of [90, 180, 365, 730, null])
        assert.ok(
            historyRetentionSettingsSchema.safeParse({ retentionDays }).success
        )
    for (const retentionDays of [0, 1, 30, 1000, "90", undefined])
        assert.ok(
            !historyRetentionSettingsSchema.safeParse({ retentionDays }).success
        )
    assert.ok(
        !historyRetentionSettingsSchema.safeParse({
            retentionDays: 90,
            extra: true,
        }).success
    )
})
