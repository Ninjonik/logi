import assert from "node:assert/strict"
import test from "node:test"

import {
    defaultSeedPlanSettings,
    initialSeedPlanState,
    type SeedPlanSettings,
    type SeedPlanState,
} from "./plan"
import {
    decideManualSeedStart,
    evaluateSeedTriggers,
    isAutoArmed,
} from "./triggers"

const PRAGUE = "Europe/Prague"
const at = (iso: string) => Date.parse(iso)
const HOUR = 3_600_000

const plan = (overrides: Partial<SeedPlanSettings> = {}): SeedPlanSettings => ({
    ...defaultSeedPlanSettings(),
    enabled: true,
    schedule: {
        enabled: true,
        slots: [{ days: [1, 2, 3, 4, 5], time: "17:00" }],
    },
    auto: { enabled: true, below: 20, from: "15:00", to: "22:00" },
    seedChannelId: "111111111111111111",
    seedRoleId: "333333333333333333",
    ...overrides,
})
const state = (overrides: Partial<SeedPlanState> = {}): SeedPlanState => ({
    ...initialSeedPlanState(),
    ...overrides,
})
// Monday 2026-10-05 17:02 Prague: the weekday slot is due, the auto window open.
const SLOT_NOW = at("2026-10-05T15:02:00Z")
const SLOT_KEY = "2026-10-05T17:00"
// Monday 2026-10-05 19:30 Prague: no slot due, the auto window open.
const AUTO_NOW = at("2026-10-05T17:30:00Z")

const evaluate = (
    input: Partial<Parameters<typeof evaluateSeedTriggers>[0]> = {}
) =>
    evaluateSeedTriggers({
        plan: plan(),
        state: state(),
        reading: { players: 12, online: true },
        paused: false,
        now: SLOT_NOW,
        timeZone: PRAGUE,
        ...input,
    })

test("a due schedule slot starts a seed below the start threshold and consumes the slot", () => {
    assert.deepEqual(evaluate(), {
        kind: "start",
        trigger: {
            kind: "schedule",
            days: [1, 2, 3, 4, 5],
            time: "17:00",
            occurrence: SLOT_KEY,
        },
        consume: SLOT_KEY,
    })
})

test("a slot fires only when the server is under the start threshold at that moment (P3-B02)", () => {
    assert.deepEqual(evaluate({ reading: { players: 20, online: true } }), {
        kind: "skip",
        reason: "not_below_start",
        consume: SLOT_KEY,
    })
})

test("a decided slot never fires twice, even on duplicate ticks", () => {
    const decision = evaluate({
        state: state({ consumedOccurrence: SLOT_KEY }),
        plan: plan({ auto: { ...plan().auto, enabled: false } }),
    })
    assert.deepEqual(decision, { kind: "idle" })
})

test("a slot is consumed while a seed runs, paused or in the cooldown, and retried without data", () => {
    assert.deepEqual(evaluate({ state: state({ activeRunId: "run" }) }), {
        kind: "skip",
        reason: "running",
        consume: SLOT_KEY,
    })
    assert.deepEqual(evaluate({ paused: true }), {
        kind: "skip",
        reason: "paused",
        consume: SLOT_KEY,
    })
    assert.deepEqual(
        evaluate({ state: state({ lastStartedAt: SLOT_NOW - HOUR }) }),
        { kind: "skip", reason: "cooldown", consume: SLOT_KEY }
    )
    assert.deepEqual(evaluate({ reading: null }), {
        kind: "skip",
        reason: "no_data",
        consume: null,
    })
    assert.deepEqual(evaluate({ reading: { players: 0, online: false } }), {
        kind: "skip",
        reason: "offline",
        consume: null,
    })
})

test("a plan that is off never starts anything", () => {
    assert.deepEqual(evaluate({ plan: plan({ enabled: false }) }), {
        kind: "idle",
    })
})

test("the automatic trigger starts below its threshold inside the window", () => {
    assert.deepEqual(evaluate({ now: AUTO_NOW }), {
        kind: "start",
        trigger: { kind: "auto", below: 20 },
        consume: null,
    })
})

test("the automatic trigger stays idle outside the window, at the threshold, when off or paused", () => {
    assert.deepEqual(evaluate({ now: at("2026-10-05T12:00:00Z") }), {
        kind: "idle",
    })
    assert.deepEqual(
        evaluate({ now: AUTO_NOW, reading: { players: 20, online: true } }),
        { kind: "idle" }
    )
    assert.deepEqual(
        evaluate({
            now: AUTO_NOW,
            plan: plan({ auto: { ...plan().auto, enabled: false } }),
        }),
        { kind: "idle" }
    )
    assert.deepEqual(evaluate({ now: AUTO_NOW, paused: true }), {
        kind: "idle",
    })
    assert.deepEqual(evaluate({ now: AUTO_NOW, reading: null }), {
        kind: "idle",
    })
})

test("the automatic trigger respects the cooldown without consuming anything", () => {
    assert.deepEqual(
        evaluate({
            now: AUTO_NOW,
            state: state({ lastStartedAt: AUTO_NOW - HOUR }),
        }),
        { kind: "skip", reason: "cooldown", consume: null }
    )
})

test("the automatic trigger fires once per emptying, again after the server was live or in a new window", () => {
    const windowOpened = at("2026-10-05T13:00:00Z")
    const autoStarted = windowOpened + HOUR
    const afterCooldown = autoStarted + 3 * HOUR
    assert.deepEqual(
        evaluate({
            now: afterCooldown,
            state: state({
                lastStartedAt: autoStarted,
                lastAutoStartAt: autoStarted,
            }),
        }),
        { kind: "idle" },
        "a failed automatic seed is not repeated every cooldown"
    )
    assert.equal(
        evaluate({
            now: afterCooldown,
            state: state({
                lastStartedAt: autoStarted,
                lastAutoStartAt: autoStarted,
                lastLiveAt: autoStarted + HOUR,
            }),
        }).kind,
        "start"
    )
    assert.equal(
        evaluate({
            now: at("2026-10-06T13:30:00Z"),
            state: state({
                lastStartedAt: autoStarted,
                lastAutoStartAt: autoStarted,
            }),
        }).kind,
        "start",
        "the next day's window re-arms it"
    )
    assert.equal(
        isAutoArmed({ lastAutoStartAt: null, lastLiveAt: null }, 0),
        true
    )
})

test("a manual start works below the live threshold at any time of day", () => {
    const manual = (
        overrides: Partial<Parameters<typeof decideManualSeedStart>[0]> = {}
    ) =>
        decideManualSeedStart({
            plan: plan({ schedule: { enabled: false, slots: [] } }),
            state: state(),
            reading: { players: 36, online: true },
            now: at("2026-10-05T03:00:00Z"),
            ...overrides,
        })
    assert.deepEqual(manual(), { ok: true })
    assert.deepEqual(manual({ reading: null }), { ok: true })
    assert.deepEqual(manual({ state: state({ activeRunId: "run" }) }), {
        ok: false,
        refusal: { kind: "running" },
    })
    assert.deepEqual(manual({ plan: plan({ seedChannelId: null }) }), {
        ok: false,
        refusal: { kind: "not_configured" },
    })
    assert.deepEqual(manual({ reading: { players: 0, online: false } }), {
        ok: false,
        refusal: { kind: "offline" },
    })
    assert.deepEqual(manual({ reading: { players: 40, online: true } }), {
        ok: false,
        refusal: { kind: "already_live", players: 40 },
    })
    assert.deepEqual(
        manual({
            state: state({ lastStartedAt: at("2026-10-05T02:20:00Z") }),
        }),
        {
            ok: false,
            refusal: {
                kind: "cooldown",
                retryAt: at("2026-10-05T04:20:00Z"),
                remainingMs: 80 * 60_000,
            },
        }
    )
})

test("a manual start works with the plan switched off; only the cooldown limits it (P3-09, P3-B02)", () => {
    const off = plan({
        enabled: false,
        schedule: { enabled: false, slots: [] },
        auto: { enabled: false, below: 20, from: "15:00", to: "22:00" },
    })
    const manual = (
        overrides: Partial<Parameters<typeof decideManualSeedStart>[0]> = {}
    ) =>
        decideManualSeedStart({
            plan: off,
            state: state(),
            reading: { players: 12, online: true },
            now: at("2026-10-06T11:00:00Z"),
            ...overrides,
        })
    assert.deepEqual(manual(), { ok: true }, "Seed teď: Jde vždy")
    assert.deepEqual(manual({ reading: null }), { ok: true })
    assert.deepEqual(
        manual({ state: state({ lastStartedAt: at("2026-10-06T10:00:00Z") }) }),
        {
            ok: false,
            refusal: {
                kind: "cooldown",
                retryAt: at("2026-10-06T12:00:00Z"),
                remainingMs: HOUR,
            },
        },
        "the cooldown between seeds still applies"
    )
    assert.deepEqual(
        manual({ state: state({ lastStartedAt: at("2026-10-06T09:00:00Z") }) }),
        { ok: true },
        "a start exactly at the end of the cooldown works"
    )
    // The switch still stops the schedule and the automatic trigger.
    assert.deepEqual(
        evaluate({ plan: { ...off, schedule: plan().schedule } }),
        { kind: "idle" }
    )
})
