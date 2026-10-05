import assert from "node:assert/strict"
import test from "node:test"

import { summarizeSeedHistory, toSeedHistoryEntry } from "./history"
import { startSeedRun, type SeedRun, type SeedTrigger } from "./run"

const MINUTE = 60_000
const NOW = Date.parse("2026-10-05T16:00:00Z")
const ROLE = "333333333333333333"

function run(input: {
    id: string
    startedAt: string
    trigger: SeedTrigger
    status: SeedRun["status"]
    start: number
    end: number
    minutes: number
    ping?: SeedRun["ping"]
    pingedMembers?: number | null
}): SeedRun & { id: string } {
    const startedAt = Date.parse(input.startedAt)
    const base = startSeedRun({
        trigger: input.trigger,
        now: startedAt,
        plan: { liveFrom: 40, maxDurationMinutes: 120, endAction: "edit" },
        ping: input.ping ?? { kind: "role", roleId: ROLE },
        observation: {
            players: input.start,
            capacity: 100,
            map: "Foy",
            observedAt: startedAt,
        },
    })
    return {
        ...base,
        id: input.id,
        status: input.status,
        endedAt: startedAt + input.minutes * MINUTE,
        callPostedAt: startedAt,
        pingedMembers: input.pingedMembers ?? 34,
        players: {
            ...base.players,
            latest: input.end,
            peak: Math.max(input.start, input.end),
            end: input.end,
        },
    }
}

const schedule: SeedTrigger = {
    kind: "schedule",
    days: [1, 2, 3, 4, 5],
    time: "17:00",
    occurrence: "2026-10-05T17:00",
}
/** The five rows of the P3 board, newest first. */
const boardRows = [
    run({
        id: "a",
        startedAt: "2026-10-05T15:00:00Z",
        trigger: schedule,
        status: "live",
        start: 11,
        end: 41,
        minutes: 42,
    }),
    run({
        id: "b",
        startedAt: "2026-10-04T13:20:00Z",
        trigger: {
            kind: "manual",
            actor: { id: "100000000000000001", name: "Hráč 01" },
            via: "web",
            channelId: null,
        },
        status: "live",
        start: 6,
        end: 40,
        minutes: 65,
    }),
    run({
        id: "c",
        startedAt: "2026-10-03T14:45:00Z",
        trigger: { kind: "auto", below: 20 },
        status: "live",
        start: 18,
        end: 43,
        minutes: 21,
        ping: {
            kind: "silent",
            reason: "ping_window",
            windowMinutes: 240,
            nextPingAt: Date.parse("2026-10-03T16:00:00Z"),
        },
        pingedMembers: null,
    }),
    run({
        id: "d",
        startedAt: "2026-10-02T15:00:00Z",
        trigger: schedule,
        status: "ended_timeout",
        start: 14,
        end: 31,
        minutes: 120,
        pingedMembers: 33,
    }),
    run({
        id: "e",
        startedAt: "2026-10-01T18:10:00Z",
        trigger: {
            kind: "manual",
            actor: { id: "100000000000000002", name: "Hráč 02" },
            via: "discord",
            channelId: "222222222222222222",
        },
        status: "live",
        start: 9,
        end: 40,
        minutes: 55,
        pingedMembers: 33,
    }),
]

test("history rows carry what the P3 table shows", () => {
    const [scheduled, manual, automatic, timedOut, button] = boardRows.map(
        (row) => toSeedHistoryEntry(row, NOW)
    )
    assert.deepEqual(scheduled, {
        id: "a",
        startedAt: "2026-10-05T15:00:00.000Z",
        endedAt: "2026-10-05T15:42:00.000Z",
        trigger: { kind: "schedule", days: [1, 2, 3, 4, 5], time: "17:00" },
        playersAtStart: 11,
        playersAtEnd: 41,
        outcome: "live",
        durationMinutes: 42,
        ping: { kind: "role", roleId: ROLE, members: 34 },
        seeders: 30,
        endedByName: null,
        failure: null,
    })
    assert.deepEqual(manual.trigger, {
        kind: "manual",
        actorName: "Hráč 01",
        via: "web",
        channelId: null,
    })
    assert.equal(manual.durationMinutes, 65)
    assert.deepEqual(automatic.trigger, { kind: "auto", below: 20 })
    assert.deepEqual(automatic.ping, {
        kind: "silent",
        reason: "ping_window",
        windowMinutes: 240,
    })
    assert.equal(timedOut.outcome, "timeout")
    assert.equal(timedOut.durationMinutes, 120)
    assert.deepEqual(timedOut.ping, { kind: "role", roleId: ROLE, members: 33 })
    assert.equal(
        button.trigger.kind === "manual" && button.trigger.via,
        "discord"
    )
})

test("history never exposes the actor's Discord ID", () => {
    for (const row of boardRows)
        assert.equal(
            JSON.stringify(toSeedHistoryEntry(row, NOW)).includes(
                "10000000000000000"
            ),
            false
        )
})

test("a running seed reports its elapsed time and latest count", () => {
    const running: SeedRun & { id: string } = {
        ...boardRows[0],
        id: "live-now",
        status: "seeding",
        endedAt: null,
        players: { ...boardRows[0].players, latest: 31, end: null },
    }
    const entry = toSeedHistoryEntry(
        running,
        Date.parse("2026-10-05T15:30:00Z")
    )
    assert.equal(entry.outcome, "running")
    assert.equal(entry.endedAt, null)
    assert.equal(entry.durationMinutes, 30)
    assert.equal(entry.playersAtEnd, 31)
    assert.equal(entry.seeders, null)
})

test("an admin-ended seed names who ended it", () => {
    const ended: SeedRun & { id: string } = {
        ...boardRows[0],
        status: "ended_admin",
        endedBy: { id: "100000000000000001", name: "Hráč 01", via: "web" },
    }
    const entry = toSeedHistoryEntry(ended, NOW)
    assert.equal(entry.outcome, "admin")
    assert.equal(entry.endedByName, "Hráč 01")
})

test("the summary counts 30 days and averages the time to live", () => {
    const old = { ...boardRows[0], startedAt: NOW - 31 * 24 * 60 * MINUTE }
    assert.deepEqual(summarizeSeedHistory([...boardRows, old], NOW), {
        days: 30,
        count: 5,
        liveCount: 4,
        averageMinutesToLive: 46,
    })
    assert.deepEqual(summarizeSeedHistory([boardRows[3]], NOW), {
        days: 30,
        count: 1,
        liveCount: 0,
        averageMinutesToLive: null,
    })
    assert.deepEqual(summarizeSeedHistory([], NOW), {
        days: 30,
        count: 0,
        liveCount: 0,
        averageMinutesToLive: null,
    })
})
