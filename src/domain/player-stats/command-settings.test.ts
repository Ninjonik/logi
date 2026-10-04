import {
    DEFAULT_STATS_COMMAND_SETTINGS,
    resolveStatsShareChannel,
    statsCommandAccess,
    statsCommandSettingsSchema,
} from "./command-settings"
import assert from "node:assert/strict"
import test from "node:test"

test("missing settings keep /stats available for both games", () => {
    assert.equal(statsCommandAccess(undefined, "hll"), "allowed")
    assert.equal(statsCommandAccess(undefined, "wardogs"), "allowed")
    assert.equal(
        resolveStatsShareChannel(undefined, "444444444444444444"),
        "444444444444444444"
    )
    assert.equal(resolveStatsShareChannel(undefined, undefined), undefined)
})

test("the command switch wins over game switches and the default room fills a missing channel", () => {
    const off = { ...DEFAULT_STATS_COMMAND_SETTINGS, enabled: false }
    assert.equal(statsCommandAccess(off, "hll"), "disabled")
    const wardogsOnly = {
        enabled: true,
        games: { hell_let_loose: false, wardogs: true },
        defaultShareChannelId: "444444444444444444",
    }
    assert.equal(statsCommandAccess(wardogsOnly, "hll"), "game_disabled")
    assert.equal(statsCommandAccess(wardogsOnly, "wardogs"), "allowed")
    assert.equal(
        resolveStatsShareChannel(wardogsOnly, undefined),
        "444444444444444444"
    )
    assert.equal(
        resolveStatsShareChannel(wardogsOnly, "555555555555555555"),
        "555555555555555555"
    )
})

test("stored settings reject unknown games, malformed rooms and extra keys", () => {
    assert.ok(
        statsCommandSettingsSchema.safeParse(DEFAULT_STATS_COMMAND_SETTINGS)
            .success
    )
    assert.ok(
        !statsCommandSettingsSchema.safeParse({
            enabled: true,
            games: { hell_let_loose: true, wardogs: true, vietnam: true },
        }).success
    )
    assert.ok(
        !statsCommandSettingsSchema.safeParse({
            enabled: true,
            games: { hell_let_loose: true, wardogs: true },
            defaultShareChannelId: "general",
        }).success
    )
})
