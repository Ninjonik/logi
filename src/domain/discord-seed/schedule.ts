import {
    dateOfDay,
    localMoment,
    parseClock,
    weekdayOfDay,
    zonedInstant,
} from "./clock"
import type { SeedPlanSettings, SeedScheduleSlot } from "./plan"

const MINUTE_MS = 60 * 1000

/**
 * A scheduled seed may still start this long after its slot time, so a missed
 * or late evaluation (stale data, a restart) does not lose the slot.
 */
export const SEED_SCHEDULE_GRACE_MINUTES = 10

export type SeedScheduleOccurrence = {
    /** Stable identity of one occurrence: local date and slot time. */
    key: string
    at: number
    days: number[]
    time: string
}

function occurrencesOnDay(
    slots: SeedScheduleSlot[],
    day: number,
    timeZone: string
): SeedScheduleOccurrence[] {
    const weekday = weekdayOfDay(day)
    const result: SeedScheduleOccurrence[] = []
    for (const slot of slots) {
        const minutes = parseClock(slot.time)
        if (minutes === null || !slot.days.includes(weekday)) continue
        result.push({
            key: `${dateOfDay(day)}T${slot.time}`,
            at: zonedInstant(day, minutes, timeZone),
            days: slot.days,
            time: slot.time,
        })
    }
    return result
}

/** The latest occurrence whose time has come within the grace window, if any. */
export function dueScheduleOccurrence(
    schedule: SeedPlanSettings["schedule"],
    now: number,
    timeZone: string,
    graceMinutes = SEED_SCHEDULE_GRACE_MINUTES
): SeedScheduleOccurrence | null {
    if (!schedule.enabled) return null
    const today = localMoment(now, timeZone).day
    let due: SeedScheduleOccurrence | null = null
    for (const day of [today - 1, today])
        for (const occurrence of occurrencesOnDay(
            schedule.slots,
            day,
            timeZone
        ))
            if (
                occurrence.at <= now &&
                now < occurrence.at + graceMinutes * MINUTE_MS &&
                (!due || occurrence.at > due.at)
            )
                due = occurrence
    return due
}

/** The next occurrence strictly after `now` ("další plánovaný seed dnes v 17:00"). */
export function nextScheduleOccurrence(
    schedule: SeedPlanSettings["schedule"],
    now: number,
    timeZone: string
): SeedScheduleOccurrence | null {
    if (!schedule.enabled) return null
    const today = localMoment(now, timeZone).day
    // Eight days cover every weekday once more, even across a DST change.
    for (let day = today; day <= today + 8; day++) {
        const next = occurrencesOnDay(schedule.slots, day, timeZone)
            .filter((occurrence) => occurrence.at > now)
            .sort((a, b) => a.at - b.at)[0]
        if (next) return next
    }
    return null
}

/**
 * Whether the automatic window is open at `now` and when the current window
 * opened. A window whose end is earlier than its start runs over midnight.
 */
export function autoWindowAt(
    auto: Pick<SeedPlanSettings["auto"], "from" | "to">,
    now: number,
    timeZone: string
): { open: boolean; openedAt: number | null } {
    const from = parseClock(auto.from)
    const to = parseClock(auto.to)
    if (from === null || to === null || from === to)
        return { open: false, openedAt: null }
    const local = localMoment(now, timeZone)
    if (from < to)
        return local.minutes >= from && local.minutes < to
            ? { open: true, openedAt: zonedInstant(local.day, from, timeZone) }
            : { open: false, openedAt: null }
    if (local.minutes >= from)
        return { open: true, openedAt: zonedInstant(local.day, from, timeZone) }
    if (local.minutes < to)
        return {
            open: true,
            openedAt: zonedInstant(local.day - 1, from, timeZone),
        }
    return { open: false, openedAt: null }
}

/**
 * Consecutive weekday runs in Monday-first order for labels such as
 * "Po–Pá 17:00": [1,2,3,4,5] → [{from:1,to:5}], [6,0] → [{from:6,to:0}].
 */
export function weekdayRanges(
    days: number[]
): Array<{ from: number; to: number }> {
    const order = [1, 2, 3, 4, 5, 6, 0]
    const chosen = new Set(days)
    const ranges: Array<{ from: number; to: number }> = []
    for (const day of order) {
        if (!chosen.has(day)) continue
        const last = ranges.at(-1)
        if (last && order.indexOf(last.to) === order.indexOf(day) - 1)
            last.to = day
        else ranges.push({ from: day, to: day })
    }
    return ranges
}
