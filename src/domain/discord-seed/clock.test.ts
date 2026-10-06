import assert from "node:assert/strict"
import test from "node:test"

import {
    dateOfDay,
    formatClock,
    isValidTimeZone,
    localMoment,
    parseClock,
    resolveClanTimeZone,
    weekdayOfDay,
    zonedInstant,
} from "./clock"

const PRAGUE = "Europe/Prague"
const at = (iso: string) => Date.parse(iso)

test("clock times parse only as zero-padded 24-hour HH:MM", () => {
    assert.equal(parseClock("17:00"), 1020)
    assert.equal(parseClock("00:00"), 0)
    assert.equal(parseClock("23:59"), 1439)
    for (const invalid of ["24:00", "7:00", "17:60", "", "17:00 ", "1700"])
        assert.equal(parseClock(invalid), null, invalid)
})

test("clock minutes format back and reject out-of-range values", () => {
    assert.equal(formatClock(1020), "17:00")
    assert.equal(formatClock(5), "00:05")
    for (const invalid of [-1, 1440, 1.5])
        assert.throws(() => formatClock(invalid), RangeError)
})

test("only real IANA zones are valid", () => {
    assert.equal(isValidTimeZone(PRAGUE), true)
    assert.equal(isValidTimeZone("UTC"), true)
    assert.equal(isValidTimeZone("Mars/Base"), false)
    assert.equal(isValidTimeZone(""), false)
})

test("local moments read the clan's wall clock, including across UTC midnight", () => {
    assert.deepEqual(localMoment(at("2026-10-05T15:00:00Z"), PRAGUE), {
        day: 20731,
        weekday: 1,
        minutes: 17 * 60,
        date: "2026-10-05",
    })
    const lateSunday = localMoment(at("2026-10-04T22:30:00Z"), PRAGUE)
    assert.equal(lateSunday.date, "2026-10-05")
    assert.equal(lateSunday.weekday, 1)
    assert.equal(lateSunday.minutes, 30)
    assert.equal(weekdayOfDay(0), 4, "1970-01-01 was a Thursday")
    assert.equal(dateOfDay(20731), "2026-10-05")
})

test("zoned instants follow summer and winter time", () => {
    assert.equal(
        new Date(zonedInstant(20731, 17 * 60, PRAGUE)).toISOString(),
        "2026-10-05T15:00:00.000Z"
    )
    const november = Math.floor(at("2026-11-02T00:00:00Z") / 86_400_000)
    assert.equal(
        new Date(zonedInstant(november, 17 * 60, PRAGUE)).toISOString(),
        "2026-11-02T16:00:00.000Z"
    )
})

test("a wall-clock time skipped or repeated by DST resolves to one real instant", () => {
    const springDay = Math.floor(at("2026-03-29T00:00:00Z") / 86_400_000)
    const skipped = zonedInstant(springDay, 150, PRAGUE)
    assert.equal(new Date(skipped).toISOString(), "2026-03-29T01:30:00.000Z")
    assert.equal(localMoment(skipped, PRAGUE).minutes, 3 * 60 + 30)
    const autumnDay = Math.floor(at("2026-10-25T00:00:00Z") / 86_400_000)
    const repeated = zonedInstant(autumnDay, 150, PRAGUE)
    assert.equal(localMoment(repeated, PRAGUE).minutes, 150)
})

test("a clan without a valid zone schedules in UTC, like event recurrence", () => {
    assert.equal(resolveClanTimeZone("Europe/Prague"), "Europe/Prague")
    assert.equal(resolveClanTimeZone(undefined), "UTC")
    assert.equal(resolveClanTimeZone(null), "UTC")
    assert.equal(resolveClanTimeZone("Mars/Base"), "UTC")
})

test("an unknown zone is an error in the clock itself", () => {
    assert.throws(() => localMoment(0, "Mars/Base"), RangeError)
})
