import assert from "node:assert/strict"
import test from "node:test"

import { boardSeedSettings } from "@/infrastructure/testing/in-memory-seed"
import type { SeedHistoryEntry } from "@/domain/discord-seed/history"
import { getSeedMessages } from "@/lib/clan-language/seed"
import { csMessages } from "@/i18n/messages/cs"

import {
    checkSeedPlanDraft,
    formatSeedHours,
    insertSeedToken,
    nextSeedSlot,
    parseSeedHours,
    seedAgo,
    seedCallPreviews,
    seedDayTime,
    seedHistoryRow,
    seedIssueAt,
    seedPlanChangeCount,
    seedPlanDraft,
    seedPlanInput,
    seedTemplateTokens,
    toggleSeedSlotDay,
} from "./seed-page-state"

const NOW = Date.parse("2026-10-05T15:40:00.000Z") // 17:40 in Prague, a Monday
const TZ = "Europe/Prague"
const text = csMessages.seedPage

test("hours are edited as text and stored as minutes", () => {
    assert.equal(formatSeedHours(240, "cs"), "4")
    assert.equal(formatSeedHours(90, "cs"), "1,5")
    assert.equal(formatSeedHours(90, "en"), "1.5")
    assert.equal(formatSeedHours(45, "de"), "0,75")
    assert.equal(parseSeedHours("1,5"), 90)
    assert.equal(parseSeedHours(" 2 "), 120)
    assert.equal(parseSeedHours("0.75"), 45)
    assert.ok(Number.isNaN(parseSeedHours("")))
    assert.ok(Number.isNaN(parseSeedHours("2h")))
    assert.ok(Number.isNaN(parseSeedHours("-1")))
})

test("a saved plan round-trips through the draft unchanged", () => {
    const settings = boardSeedSettings({ cooldownMinutes: 90 })
    const draft = seedPlanDraft(settings, "cs")
    assert.equal(draft.cooldownHours, "1,5")
    assert.deepEqual(checkSeedPlanDraft(draft, 100), {
        ok: true,
        plan: settings,
    })
    assert.equal(seedPlanChangeCount(draft, draft), 0)
    assert.equal(
        seedPlanChangeCount(draft, { ...draft, cooldownHours: "1.5" }),
        0,
        "the same hours written differently are no change"
    )
})

test("each edited setting counts once (P3 save bar)", () => {
    const saved = seedPlanDraft(boardSeedSettings(), "cs")
    assert.equal(
        seedPlanChangeCount(saved, {
            ...saved,
            liveFrom: "45",
            slots: [toggleSeedSlotDay(saved.slots[0]!, 6)],
            template: "  Pojďte! ",
            controlChannelId: null,
        }),
        4
    )
    assert.equal(
        seedPlanChangeCount(saved, { ...saved, template: "  " }),
        0,
        "blank text is the default text"
    )
})

test("invalid drafts report the server's codes at their fields", () => {
    const saved = seedPlanDraft(boardSeedSettings(), "cs")
    const order = checkSeedPlanDraft({ ...saved, liveFrom: "20" }, 100)
    assert.equal(
        order.ok ? null : seedIssueAt(order.issues, "startBelow"),
        "start_below_not_under_live"
    )
    const unreadable = checkSeedPlanDraft(
        { ...saved, pingWindowHours: "x" },
        100
    )
    assert.equal(unreadable.ok, false)
    if (unreadable.ok) return
    assert.equal(seedIssueAt(unreadable.issues, "pingWindowMinutes"), "invalid")
    assert.equal(seedIssueAt(unreadable.issues, "template"), null)
    const capacity = checkSeedPlanDraft({ ...saved, liveFrom: "80" }, 64)
    assert.deepEqual(capacity, {
        ok: false,
        issues: [{ path: "liveFrom", code: "live_above_capacity" }],
    })
    const slots = checkSeedPlanDraft(
        {
            ...saved,
            slots: [
                { days: [1], time: "17:00" },
                { days: [1], time: "17:00" },
            ],
        },
        null
    )
    assert.equal(
        slots.ok ? null : seedIssueAt(slots.issues, "schedule.slots"),
        "duplicate_slot"
    )
})

test("an empty call text sends null so Logi uses its default text", () => {
    const draft = seedPlanDraft(boardSeedSettings(), "cs")
    assert.equal(seedPlanInput({ ...draft, template: "   " }).template, null)
    assert.equal(
        seedPlanInput({ ...draft, template: " Pojďte {server} " }).template,
        "Pojďte {server}"
    )
})

test("schedule slots: weekday toggles and the next free slot", () => {
    assert.deepEqual(toggleSeedSlotDay({ days: [1, 5], time: "17:00" }, 3), {
        days: [1, 3, 5],
        time: "17:00",
    })
    assert.deepEqual(toggleSeedSlotDay({ days: [1, 3], time: "17:00" }, 3), {
        days: [1],
        time: "17:00",
    })
    assert.deepEqual(nextSeedSlot([{ days: [1, 2, 3, 4, 5], time: "17:00" }]), {
        days: [6],
        time: "17:00",
    })
    assert.equal(
        nextSeedSlot(
            Array.from({ length: 7 }, (_, day) => ({
                days: [day],
                time: "10:00",
            }))
        ),
        null
    )
})

test("placeholders in the clan language go in at the cursor", () => {
    assert.deepEqual(seedTemplateTokens("cs"), [
        "{server}",
        "{hráči}",
        "{chybí}",
        "{hranice}",
    ])
    assert.deepEqual(seedTemplateTokens("xx")[1], "{players}")
    assert.deepEqual(insertSeedToken("Chybí hráči", "{chybí}", null), {
        text: "Chybí hráči {chybí}",
        caret: 19,
    })
    assert.deepEqual(
        insertSeedToken("Chybí  hráči", "{chybí}", { start: 6, end: 6 }),
        { text: "Chybí {chybí} hráči", caret: 13 }
    )
})

test("the call preview uses the bot's words, the plan and the current count (P3-19, P3-20)", () => {
    const draft = seedPlanDraft(boardSeedSettings(), "cs")
    const previews = seedCallPreviews({
        draft,
        fallback: { liveFrom: 40 },
        server: { name: "Vlci #1 · Public", gameId: "hell_let_loose" },
        reading: { players: 12, capacity: 100 },
        mapLine: "Foy",
        actorName: "Hráč 01",
        joinUrl: "https://logi.invalid/cs/join/vlci-1",
        now: NOW,
        timeZone: TZ,
        copy: getSeedMessages("cs"),
    })
    assert.equal(previews.leadRoleId, boardSeedSettings().seedRoleId)
    assert.equal(previews.seeding.header?.title, "Seedujeme Vlci #1 · Public")
    const blocks = JSON.stringify(previews.seeding.blocks)
    assert.match(blocks, /▰▰▰▱▱▱▱▱▱▱ \*\*12 \/ 40\*\*/)
    assert.match(blocks, /Plán Po–Pá 17:00|Po–Pá 17:00/)
    assert.match(blocks, /Zvát mě na seed/)
    assert.equal(previews.live?.header?.title, "Server je živý")

    const custom = seedCallPreviews({
        draft: {
            ...draft,
            template: "Chybí {chybí}, pak hrajeme na {server}.",
            endAction: "delete",
            seedRoleId: null,
            liveFrom: "",
        },
        fallback: { liveFrom: 40 },
        server: { name: "Vlci #1 · Public", gameId: "hell_let_loose" },
        reading: { players: 55, capacity: 100 },
        mapLine: null,
        actorName: "Hráč 01",
        joinUrl: "https://logi.invalid/cs/join/vlci-1",
        now: NOW,
        timeZone: TZ,
        copy: getSeedMessages("cs"),
    })
    assert.equal(custom.leadRoleId, null, "no role, no ping line")
    assert.equal(custom.live, null, "the call is deleted at the threshold")
    const customBlocks = JSON.stringify(custom.seeding.blocks)
    assert.match(
        customBlocks,
        /\*\*12 \/ 40\*\*/,
        "a live server previews 30 %"
    )
    assert.match(customBlocks, /Chybí 28, pak hrajeme na Vlci #1 · Public\./)
    assert.doesNotMatch(customBlocks, /Zvát mě na seed/)
})

test("times read as today, yesterday or a date in the clan's zone", () => {
    const time = text.time
    assert.equal(
        seedDayTime("2026-10-05T15:00:00.000Z", NOW, TZ, "cs", time),
        "dnes v 17:00"
    )
    assert.equal(
        seedDayTime("2026-10-04T15:00:00.000Z", NOW, TZ, "cs", time),
        "včera v 17:00"
    )
    assert.equal(
        seedDayTime("2026-10-06T15:00:00.000Z", NOW, TZ, "cs", time),
        "zítra v 17:00"
    )
    assert.equal(
        seedDayTime("2026-10-02T15:00:00.000Z", NOW, TZ, "cs", time),
        "pá 2. 10. v 17:00"
    )
    assert.equal(seedAgo("2026-10-05T15:39:20.000Z", NOW, "cs"), "před 40 s")
})

const entry = (overrides: Partial<SeedHistoryEntry>): SeedHistoryEntry => ({
    id: "r1",
    startedAt: "2026-10-05T15:00:00.000Z",
    endedAt: "2026-10-05T15:42:00.000Z",
    trigger: { kind: "schedule", days: [1, 2, 3, 4, 5], time: "17:00" },
    playersAtStart: 11,
    playersAtEnd: 41,
    outcome: "live",
    durationMinutes: 42,
    ping: { kind: "role", roleId: "r", members: 34 },
    seeders: 30,
    endedByName: null,
    failure: null,
    ...overrides,
})
const rowInput = {
    timeZone: TZ,
    locale: "cs",
    weekdays: text.plan.weekdays,
    text: text.history,
    channelName: (id: string) => (id === "c" ? "spravci" : null),
    roleName: (id: string) => (id === "r" ? "Seed" : null),
}

test("history rows read like the board (P3-27..32)", () => {
    assert.deepEqual(seedHistoryRow(entry({}), rowInput), {
        id: "r1",
        start: "po 5. 10. · 17:00",
        startedBy: "Plán Po–Pá 17:00",
        players: "11 → 41",
        outcome: { label: "Živý", tone: "success" },
        duration: "42 min",
        pinged: "34 · @Seed",
    })
    const web = seedHistoryRow(
        entry({
            trigger: {
                kind: "manual",
                actorName: "Hráč 01",
                via: "web",
                channelId: null,
            },
            durationMinutes: 65,
        }),
        rowInput
    )
    assert.equal(web.startedBy, "Hráč 01 · ručně na webu")
    assert.equal(web.duration, "1 h 05 min")
    const auto = seedHistoryRow(
        entry({
            trigger: { kind: "auto", below: 20 },
            ping: { kind: "silent", reason: "ping_window", windowMinutes: 240 },
        }),
        rowInput
    )
    assert.equal(auto.startedBy, "Automaticky · pod 20")
    assert.equal(auto.pinged, "0 · ochrana 4 h")
    const timeout = seedHistoryRow(
        entry({
            outcome: "timeout",
            durationMinutes: 120,
            playersAtEnd: 31,
        }),
        rowInput
    )
    assert.deepEqual(timeout.outcome, {
        label: "Nedosáhl hranice",
        tone: "warning",
    })
    assert.equal(timeout.duration, "2 h · ukončen")
    const discord = seedHistoryRow(
        entry({
            trigger: {
                kind: "manual",
                actorName: "Hráč 02",
                via: "discord",
                channelId: "c",
            },
            ping: { kind: "silent", reason: "no_role" },
        }),
        rowInput
    )
    assert.equal(discord.startedBy, "Hráč 02 · tlačítko v #spravci")
    assert.equal(discord.pinged, "0 · bez role")
    assert.equal(
        seedHistoryRow(
            entry({
                ping: { kind: "role", roleId: "gone", members: null },
                playersAtStart: null,
            }),
            rowInput
        ).pinged,
        "? · @role"
    )
})
