import assert from "node:assert/strict"
import test from "node:test"

import {
    defaultSeedPlanSettings,
    initialSeedPlanState,
    parseSeedPlanSettings,
    seedPlanCapacityIssues,
    type SeedPlanSettings,
} from "./plan"

const SEED = "111111111111111111"
const CONTROL = "222222222222222222"
const ROLE = "333333333333333333"

/** The plan drawn on the P3 board. */
function boardPlan(): SeedPlanSettings {
    return {
        ...defaultSeedPlanSettings(),
        enabled: true,
        schedule: {
            enabled: true,
            slots: [{ days: [5, 4, 3, 2, 1], time: "17:00" }],
        },
        auto: { enabled: true, below: 20, from: "15:00", to: "22:00" },
        seedChannelId: SEED,
        controlChannelId: CONTROL,
        seedRoleId: ROLE,
        template:
            "  Server se rozjíždí. Připoj se a pomoz ho naplnit; jakmile bude {hranice} hráčů, hraje se naostro.  ",
    }
}

const codes = (input: unknown) => {
    const result = parseSeedPlanSettings(input)
    return result.ok ? [] : result.issues.map((issue) => issue.code)
}

test("the defaults carry the owner decisions: 40/20, 2 h cooldown, 4 h ping window, 2 h maximum", () => {
    const plan = defaultSeedPlanSettings()
    assert.equal(plan.liveFrom, 40)
    assert.equal(plan.startBelow, 20)
    assert.equal(plan.cooldownMinutes, 120)
    assert.equal(plan.pingWindowMinutes, 240)
    assert.equal(plan.maxDurationMinutes, 120)
    assert.equal(plan.endAction, "edit")
    assert.equal(plan.roleSelfService, true)
    assert.equal(plan.enabled, false, "nothing runs before a channel is chosen")
    assert.deepEqual(parseSeedPlanSettings(plan), { ok: true, plan })
    assert.deepEqual(initialSeedPlanState(), {
        phase: null,
        lastStartedAt: null,
        lastPingAt: null,
        lastLiveAt: null,
        lastAutoStartAt: null,
        consumedOccurrence: null,
        activeRunId: null,
    })
})

test("the board's plan parses, with sorted days and a trimmed text", () => {
    const result = parseSeedPlanSettings(boardPlan())
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.plan.schedule.slots[0].days, [1, 2, 3, 4, 5])
    assert.equal(
        result.plan.template,
        "Server se rozjíždí. Připoj se a pomoz ho naplnit; jakmile bude {hranice} hráčů, hraje se naostro."
    )
})

test("an empty text falls back to the clan-language default", () => {
    const result = parseSeedPlanSettings({ ...boardPlan(), template: "   " })
    assert.equal(result.ok && result.plan.template, null)
})

test("every value the owner made editable can change within its range", () => {
    const result = parseSeedPlanSettings({
        ...boardPlan(),
        liveFrom: 50,
        startBelow: 30,
        auto: { enabled: true, below: 25, from: "22:00", to: "02:00" },
        pingWindowMinutes: 6 * 60,
        cooldownMinutes: 90,
        maxDurationMinutes: 180,
        endAction: "delete",
        roleSelfService: false,
    })
    assert.equal(result.ok, true)
})

test("cross-field rules report stable codes and paths", () => {
    const issues = (input: unknown) => {
        const result = parseSeedPlanSettings(input)
        return result.ok ? [] : result.issues
    }
    assert.deepEqual(issues({ ...boardPlan(), startBelow: 40 }), [
        { path: "startBelow", code: "start_below_not_under_live" },
    ])
    assert.deepEqual(
        issues({
            ...boardPlan(),
            auto: { ...boardPlan().auto, below: 21 },
        }),
        [{ path: "auto.below", code: "auto_below_above_start" }]
    )
    assert.deepEqual(
        issues({
            ...boardPlan(),
            auto: { ...boardPlan().auto, to: "15:00" },
        }),
        [{ path: "auto.to", code: "auto_window_empty" }]
    )
    assert.deepEqual(
        issues({ ...boardPlan(), schedule: { enabled: true, slots: [] } }),
        [{ path: "schedule.slots", code: "schedule_without_slots" }]
    )
    assert.deepEqual(issues({ ...boardPlan(), seedChannelId: null }), [
        { path: "seedChannelId", code: "seed_channel_required" },
    ])
    assert.deepEqual(issues({ ...boardPlan(), controlChannelId: SEED }), [
        { path: "controlChannelId", code: "control_channel_same_as_seed" },
    ])
    assert.deepEqual(
        issues({ ...boardPlan(), template: "Pojď, {hrac} hráčů." }),
        [{ path: "template", code: "unknown_placeholder" }]
    )
})

test("schedule slots reject repeated days and repeated day/time pairs", () => {
    assert.deepEqual(
        codes({
            ...boardPlan(),
            schedule: {
                enabled: true,
                slots: [{ days: [1, 1], time: "17:00" }],
            },
        }),
        ["duplicate_day"]
    )
    assert.deepEqual(
        codes({
            ...boardPlan(),
            schedule: {
                enabled: true,
                slots: [
                    { days: [1, 2], time: "17:00" },
                    { days: [2, 3], time: "17:00" },
                ],
            },
        }),
        ["duplicate_slot"]
    )
    assert.deepEqual(
        codes({
            ...boardPlan(),
            schedule: {
                enabled: true,
                slots: [
                    { days: [6], time: "10:00" },
                    { days: [6], time: "17:00" },
                ],
            },
        }),
        [],
        "the same day at two times is fine"
    )
})

test("a disabled schedule may keep no slots and a disabled plan needs no channel", () => {
    assert.deepEqual(
        codes({
            ...boardPlan(),
            enabled: false,
            seedChannelId: null,
            schedule: { enabled: false, slots: [] },
        }),
        []
    )
})

test("a live threshold above the server's capacity is reported once the capacity is known", () => {
    assert.deepEqual(seedPlanCapacityIssues({ liveFrom: 40 }, 98), [])
    assert.deepEqual(seedPlanCapacityIssues({ liveFrom: 99 }, 98), [
        { path: "liveFrom", code: "live_above_capacity" },
    ])
    assert.deepEqual(seedPlanCapacityIssues({ liveFrom: 400 }, null), [])
})

test("out-of-range and malformed values are invalid", () => {
    const cases: Array<[string, unknown]> = [
        ["liveFrom 1", { ...boardPlan(), liveFrom: 1, startBelow: 1 }],
        ["liveFrom 251", { ...boardPlan(), liveFrom: 251 }],
        ["fractional", { ...boardPlan(), liveFrom: 40.5 }],
        ["cooldown 29", { ...boardPlan(), cooldownMinutes: 29 }],
        ["cooldown 1441", { ...boardPlan(), cooldownMinutes: 1441 }],
        ["ping window 59", { ...boardPlan(), pingWindowMinutes: 59 }],
        ["max 14", { ...boardPlan(), maxDurationMinutes: 14 }],
        ["max 721", { ...boardPlan(), maxDurationMinutes: 721 }],
        [
            "clock",
            {
                ...boardPlan(),
                auto: { ...boardPlan().auto, from: "24:00" },
            },
        ],
        ["channel", { ...boardPlan(), seedChannelId: "#seed" }],
        ["role", { ...boardPlan(), seedRoleId: "@Seed" }],
        ["extra key", { ...boardPlan(), paused: true }],
        [
            "weekday 7",
            {
                ...boardPlan(),
                schedule: {
                    enabled: true,
                    slots: [{ days: [7], time: "17:00" }],
                },
            },
        ],
        [
            "no days",
            {
                ...boardPlan(),
                schedule: {
                    enabled: true,
                    slots: [{ days: [], time: "17:00" }],
                },
            },
        ],
        [
            "eight slots",
            {
                ...boardPlan(),
                schedule: {
                    enabled: true,
                    slots: Array.from({ length: 8 }, (_, i) => ({
                        days: [1],
                        time: `1${i}:00`,
                    })),
                },
            },
        ],
        ["long text", { ...boardPlan(), template: "x".repeat(601) }],
        ["end action", { ...boardPlan(), endAction: "archive" }],
        ["missing field", { enabled: true }],
        ["not an object", "plan"],
    ]
    for (const [name, input] of cases)
        assert.ok(codes(input).includes("invalid"), name)
})
