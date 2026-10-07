import {
    seedPlanCapacityIssues,
    SEED_LIMITS,
    type SeedEndAction,
    type SeedPlanIssue,
    type SeedPlanIssueCode,
    type SeedPlanSettings,
    type SeedScheduleSlot,
} from "@/domain/discord-seed/plan"
import {
    formatSeedDuration,
    seedCallLead,
    seedCallView,
    seedSlotLabel,
    type SeedGame,
} from "@/domain/discord-seed/views"
import type {
    SeedHistoryEntry,
    SeedOutcome,
} from "@/domain/discord-seed/history"
import type { MessageView } from "@/domain/discord-messages/message-view"
import { parseSeedPlanSettings } from "@/domain/discord-seed/plan.schema"
import type { SeedMessagesCopy } from "@/domain/discord-seed/seed-copy"
import { SEED_TEMPLATE_TOKENS } from "@/domain/discord-seed/template"
import type { SeedMapFacts } from "@/domain/discord-seed/map"
import type { SeedRun } from "@/domain/discord-seed/run"

/**
 * The state behind the "Seed serverů" page (board P3): the editable plan as
 * the admin types it, what changed since the last save, the Discord previews
 * and the rows of the status line and the history. Pure, so it is tested
 * without React.
 */

/** Number fields stay text while the admin types; durations are edited in hours. */
export type SeedPlanDraft = {
    enabled: boolean
    liveFrom: string
    startBelow: string
    scheduleEnabled: boolean
    slots: SeedScheduleSlot[]
    autoEnabled: boolean
    autoBelow: string
    autoFrom: string
    autoTo: string
    seedChannelId: string | null
    controlChannelId: string | null
    seedRoleId: string | null
    roleSelfService: boolean
    pingWindowHours: string
    cooldownHours: string
    maxDurationHours: string
    template: string
    endAction: SeedEndAction
}

/** "4", "1,5" (cs, de) or "1.5" (en) hours for a number of minutes. */
export function formatSeedHours(minutes: number, locale: string): string {
    return new Intl.NumberFormat(locale, {
        maximumFractionDigits: 2,
        useGrouping: false,
    }).format(minutes / 60)
}

/** Minutes from typed hours ("2", "1,5", "0.75"); NaN for anything else. */
export function parseSeedHours(text: string): number {
    const value = text.trim().replace(",", ".")
    return /^\d{1,3}(\.\d{1,2})?$/.test(value)
        ? Math.round(Number(value) * 60)
        : Number.NaN
}

const wholeNumber = (text: string) =>
    /^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN

export function seedPlanDraft(
    settings: SeedPlanSettings,
    locale: string
): SeedPlanDraft {
    return {
        enabled: settings.enabled,
        liveFrom: String(settings.liveFrom),
        startBelow: String(settings.startBelow),
        scheduleEnabled: settings.schedule.enabled,
        slots: settings.schedule.slots.map((slot) => ({
            days: [...slot.days],
            time: slot.time,
        })),
        autoEnabled: settings.auto.enabled,
        autoBelow: String(settings.auto.below),
        autoFrom: settings.auto.from,
        autoTo: settings.auto.to,
        seedChannelId: settings.seedChannelId,
        controlChannelId: settings.controlChannelId,
        seedRoleId: settings.seedRoleId,
        roleSelfService: settings.roleSelfService,
        pingWindowHours: formatSeedHours(settings.pingWindowMinutes, locale),
        cooldownHours: formatSeedHours(settings.cooldownMinutes, locale),
        maxDurationHours: formatSeedHours(settings.maxDurationMinutes, locale),
        template: settings.template ?? "",
        endAction: settings.endAction,
    }
}

/** The plan as the API takes it; unreadable numbers become NaN and fail validation. */
export function seedPlanInput(draft: SeedPlanDraft) {
    return {
        enabled: draft.enabled,
        liveFrom: wholeNumber(draft.liveFrom),
        startBelow: wholeNumber(draft.startBelow),
        schedule: {
            enabled: draft.scheduleEnabled,
            slots: draft.slots.map((slot) => ({
                days: [...slot.days],
                time: slot.time,
            })),
        },
        auto: {
            enabled: draft.autoEnabled,
            below: wholeNumber(draft.autoBelow),
            from: draft.autoFrom,
            to: draft.autoTo,
        },
        seedChannelId: draft.seedChannelId,
        controlChannelId: draft.controlChannelId,
        seedRoleId: draft.seedRoleId,
        roleSelfService: draft.roleSelfService,
        pingWindowMinutes: parseSeedHours(draft.pingWindowHours),
        cooldownMinutes: parseSeedHours(draft.cooldownHours),
        maxDurationMinutes: parseSeedHours(draft.maxDurationHours),
        template: draft.template.trim() || null,
        endAction: draft.endAction,
    }
}

export type SeedDraftCheck =
    | { ok: true; plan: SeedPlanSettings }
    | { ok: false; issues: SeedPlanIssue[] }

/** The same rules the server applies, plus the server's capacity when it is known. */
export function checkSeedPlanDraft(
    draft: SeedPlanDraft,
    capacity: number | null
): SeedDraftCheck {
    const parsed = parseSeedPlanSettings(seedPlanInput(draft))
    if (!parsed.ok) return parsed
    const issues = seedPlanCapacityIssues(parsed.plan, capacity)
    return issues.length ? { ok: false, issues } : parsed
}

/** The first problem at `path` or under it ("schedule.slots" covers each slot). */
export function seedIssueAt(
    issues: readonly SeedPlanIssue[],
    path: string
): SeedPlanIssueCode | null {
    return (
        issues.find(
            (issue) => issue.path === path || issue.path.startsWith(`${path}.`)
        )?.code ?? null
    )
}

const SAME_TEXT: ReadonlyArray<keyof SeedPlanDraft> = [
    "enabled",
    "liveFrom",
    "startBelow",
    "scheduleEnabled",
    "autoEnabled",
    "autoBelow",
    "autoFrom",
    "autoTo",
    "seedChannelId",
    "controlChannelId",
    "seedRoleId",
    "roleSelfService",
    "endAction",
]

/** How many settings differ from the saved plan ("1 neuložená změna"). */
export function seedPlanChangeCount(
    saved: SeedPlanDraft,
    draft: SeedPlanDraft
): number {
    let count = SAME_TEXT.filter(
        (key) => String(saved[key]).trim() !== String(draft[key]).trim()
    ).length
    const slots = (value: SeedPlanDraft) =>
        JSON.stringify(
            value.slots.map((slot) => [
                [...slot.days].sort((a, b) => a - b),
                slot.time,
            ])
        )
    if (slots(saved) !== slots(draft)) count += 1
    for (const key of [
        "pingWindowHours",
        "cooldownHours",
        "maxDurationHours",
    ] as const) {
        const before = parseSeedHours(saved[key])
        const after = parseSeedHours(draft[key])
        if (
            !(before === after) &&
            !(Number.isNaN(before) && Number.isNaN(after))
        )
            count += 1
    }
    if (saved.template.trim() !== draft.template.trim()) count += 1
    return count
}

/** Adds or removes one weekday of a schedule slot. */
export function toggleSeedSlotDay(
    slot: SeedScheduleSlot,
    day: number
): SeedScheduleSlot {
    return {
        ...slot,
        days: slot.days.includes(day)
            ? slot.days.filter((value) => value !== day)
            : [...slot.days, day].sort((a, b) => a - b),
    }
}

/** A new slot for "Přidat další čas": the days no slot uses yet, at the last slot's time. */
export function nextSeedSlot(slots: readonly SeedScheduleSlot[]) {
    if (slots.length >= SEED_LIMITS.scheduleSlots) return null
    const used = new Set(slots.flatMap((slot) => slot.days))
    const free = [1, 2, 3, 4, 5, 6, 0].filter((day) => !used.has(day))
    return {
        days: free.length ? [free[0]!] : [6],
        time: slots[slots.length - 1]?.time ?? "17:00",
    }
}

/** The placeholders offered under the call text, in the clan language. */
export function seedTemplateTokens(language: string) {
    const tokens =
        language === "cs" || language === "de"
            ? SEED_TEMPLATE_TOKENS[language]
            : SEED_TEMPLATE_TOKENS.en
    return [tokens.server, tokens.players, tokens.missing, tokens.threshold]
}

/** Puts a placeholder at the cursor, or at the end without one. */
export function insertSeedToken(
    text: string,
    token: string,
    selection: { start: number; end: number } | null
): { text: string; caret: number } {
    const start = selection
        ? Math.max(0, Math.min(selection.start, text.length))
        : text.length
    const end = selection
        ? Math.max(start, Math.min(selection.end, text.length))
        : text.length
    const before = text.slice(0, start)
    const spaced = before && !/\s$/.test(before) ? ` ${token}` : token
    return {
        text: `${before}${spaced}${text.slice(end)}`,
        caret: start + spaced.length,
    }
}

const fill = (template: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce(
        (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
        template
    )

/** A positive whole number typed in a field, or the fallback. */
const typedOr = (text: string, fallback: number) => {
    const value = wholeNumber(text)
    return Number.isInteger(value) && value >= 1 ? value : fallback
}

const MINUTE_MS = 60_000

/**
 * The call while seeding and the same message at the live threshold, from the
 * plan being edited (P3-19, P3-20). The words are the bot's own (P5), in the
 * clan language; the counts are the server's current ones when they fit. The
 * map line and picture come from `seedMapFacts`, the rule the bot posts with.
 */
export function seedCallPreviews(input: {
    draft: SeedPlanDraft
    fallback: Pick<SeedPlanSettings, "liveFrom">
    server: { name: string; gameId: SeedGame }
    reading: { players: number | null; capacity: number | null }
    /** "Foy · Warfare · Den" and the map picture, as the bot shows them. */
    map: Pick<SeedMapFacts, "mapLine" | "thumbnail">
    actorName: string
    joinUrl: string
    now: number
    timeZone: string
    copy: SeedMessagesCopy & { locale: string }
}): {
    seeding: MessageView
    /** The role pinged above the card ("@Seed"), or null for a silent call. */
    leadRoleId: string | null
    live: MessageView | null
} {
    const { draft, copy, now } = input
    const liveFrom = typedOr(draft.liveFrom, input.fallback.liveFrom)
    const current = input.reading.players
    const players =
        current !== null && current < liveFrom
            ? current
            : Math.floor(liveFrom * 0.3)
    const slot = draft.scheduleEnabled
        ? draft.slots.find((entry) => entry.days.length)
        : undefined
    const trigger: SeedRun["trigger"] = slot
        ? {
              kind: "schedule",
              days: slot.days,
              time: slot.time,
              occurrence: "preview",
          }
        : draft.autoEnabled
          ? {
                kind: "auto",
                below: typedOr(draft.autoBelow, liveFrom),
            }
          : {
                kind: "manual",
                actor: { id: "preview", name: input.actorName },
                via: "web",
                channelId: null,
            }
    const ping: SeedRun["ping"] = draft.seedRoleId
        ? { kind: "role", roleId: draft.seedRoleId }
        : { kind: "silent", reason: "no_role" }
    const base = {
        trigger,
        liveFrom,
        ping,
        endedBy: null,
    }
    const shared = {
        server: input.server,
        mapLine: input.map.mapLine,
        template: draft.template.trim() || null,
        joinUrl: input.joinUrl,
        thumbnail: input.map.thumbnail,
        // "Aktualizováno před 20 s", as between two refreshes.
        updatedAt: now - 20_000,
        timeZone: input.timeZone,
        locale: copy.locale,
        copy,
    }
    const seedingRun = {
        ...base,
        status: "seeding" as const,
        startedAt: now - 20 * MINUTE_MS,
        endedAt: null,
        players: {
            start: players,
            latest: players,
            peak: players,
            end: null,
            capacity: input.reading.capacity,
            map: null,
            observedAt: now,
        },
    }
    const reached = Math.max(liveFrom + 1, players)
    const liveRun = {
        ...base,
        status: "live" as const,
        startedAt: now - 38 * MINUTE_MS,
        endedAt: now,
        players: {
            start: players,
            latest: reached,
            peak: reached,
            end: reached,
            capacity: input.reading.capacity,
            map: null,
            observedAt: now,
        },
    }
    return {
        seeding: seedCallView({
            ...shared,
            run: seedingRun,
            roleButton:
                draft.seedRoleId && draft.roleSelfService
                    ? { roleId: draft.seedRoleId }
                    : null,
        }),
        leadRoleId: seedCallLead(seedingRun)?.roleId ?? null,
        live:
            draft.endAction === "edit"
                ? seedCallView({ ...shared, run: liveRun, roleButton: null })
                : null,
    }
}

/** "dnes v 17:00", "včera v 17:00", "po 5. 10. v 17:00" in the clan's time zone. */
export function seedDayTime(
    iso: string,
    now: number,
    timeZone: string,
    locale: string,
    text: { today: string; yesterday: string; tomorrow: string; other: string }
): string {
    const at = Date.parse(iso)
    const day = (value: number) =>
        new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(value)
    const time = new Intl.DateTimeFormat(locale, {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(at)
    const offset =
        (Date.parse(day(at)) - Date.parse(day(now))) / (24 * 60 * MINUTE_MS)
    if (offset === 0) return fill(text.today, { time })
    if (offset === -1) return fill(text.yesterday, { time })
    if (offset === 1) return fill(text.tomorrow, { time })
    return fill(text.other, { date: seedShortDate(at, timeZone, locale), time })
}

/** "po 5. 10." */
export function seedShortDate(at: number, timeZone: string, locale: string) {
    return new Intl.DateTimeFormat(locale, {
        timeZone,
        weekday: "short",
        day: "numeric",
        month: "numeric",
    }).format(at)
}

/** "před 40 s", "40s ago", "vor 40 Sek." */
export function seedAgo(iso: string, now: number, locale: string): string {
    const seconds = Math.round((Date.parse(iso) - now) / 1000)
    const format = new Intl.RelativeTimeFormat(locale, {
        numeric: "auto",
        style: "narrow",
    })
    const abs = Math.abs(seconds)
    if (abs < 60) return format.format(seconds, "second")
    if (abs < 3600) return format.format(Math.round(seconds / 60), "minute")
    if (abs < 86_400) return format.format(Math.round(seconds / 3600), "hour")
    return format.format(Math.round(seconds / 86_400), "day")
}

export type SeedChipTone = "success" | "warning" | "neutral" | "danger" | "info"

export const SEED_OUTCOME_TONES: Record<SeedOutcome, SeedChipTone> = {
    live: "success",
    timeout: "warning",
    admin: "neutral",
    failed: "danger",
    running: "info",
}

export type SeedHistoryText = {
    trigger: {
        schedule: string
        auto: string
        web: string
        discord: string
        discordNoChannel: string
    }
    outcome: Record<SeedOutcome, string>
    endedSuffix: string
    pinged: string
    silentWindow: string
    silentNoRole: string
    unknownRole: string
    units: { hours: string; minutes: string }
}

/** One row of "Historie seedů" (P3-26..32). */
export function seedHistoryRow(
    entry: SeedHistoryEntry,
    input: {
        timeZone: string
        locale: string
        /** Dashboard weekday names, index 0 = Sunday. */
        weekdays: readonly string[]
        text: SeedHistoryText
        channelName(id: string): string | null
        roleName(id: string): string | null
    }
) {
    const { text } = input
    const at = Date.parse(entry.startedAt)
    const time = new Intl.DateTimeFormat(input.locale, {
        timeZone: input.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(at)
    const trigger = entry.trigger
    const channel =
        trigger.kind === "manual" && trigger.channelId
            ? input.channelName(trigger.channelId)
            : null
    const startedBy =
        trigger.kind === "schedule"
            ? fill(text.trigger.schedule, {
                  slot: seedSlotLabel(trigger, input.weekdays),
              })
            : trigger.kind === "auto"
              ? fill(text.trigger.auto, { count: trigger.below })
              : trigger.via === "web"
                ? fill(text.trigger.web, { name: trigger.actorName })
                : channel
                  ? fill(text.trigger.discord, {
                        name: trigger.actorName,
                        channel: `#${channel}`,
                    })
                  : fill(text.trigger.discordNoChannel, {
                        name: trigger.actorName,
                    })
    const count = (value: number | null) =>
        value === null ? "?" : new Intl.NumberFormat(input.locale).format(value)
    const duration = formatSeedDuration(entry.durationMinutes, text.units)
    const ping = entry.ping
    const role =
        ping.kind === "role" ? input.roleName(ping.roleId) : (null as null)
    return {
        id: entry.id,
        start: `${seedShortDate(at, input.timeZone, input.locale)} · ${time}`,
        startedBy,
        players: `${count(entry.playersAtStart)} → ${count(entry.playersAtEnd)}`,
        outcome: {
            label: text.outcome[entry.outcome],
            tone: SEED_OUTCOME_TONES[entry.outcome],
        },
        duration:
            entry.outcome === "timeout" || entry.outcome === "admin"
                ? `${duration} · ${text.endedSuffix}`
                : duration,
        pinged:
            ping.kind === "role"
                ? fill(text.pinged, {
                      count: count(ping.members),
                      role: role ? `@${role}` : text.unknownRole,
                  })
                : ping.reason === "ping_window"
                  ? fill(text.silentWindow, {
                        hours: formatSeedHours(
                            ping.windowMinutes,
                            input.locale
                        ),
                    })
                  : text.silentNoRole,
    }
}

export { fill as fillSeedText }
