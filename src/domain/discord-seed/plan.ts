import { z } from "zod"

import {
    SEED_TEMPLATE_MAX_LENGTH,
    unknownSeedTemplatePlaceholders,
} from "./template"

/**
 * A seed plan belongs to one game server of a clan (P3 "Plán seedu"). Owner
 * decisions: live from 40 players, a seed starts under 20, at least 2 h between
 * seed starts, at most one Seed role ping per 4 h, and a maximum duration.
 * Every value is editable.
 */

export const SEED_DEFAULTS = {
    liveFrom: 40,
    startBelow: 20,
    autoBelow: 20,
    autoFrom: "15:00",
    autoTo: "22:00",
    scheduleDays: [1, 2, 3, 4, 5],
    scheduleTime: "17:00",
    pingWindowMinutes: 4 * 60,
    cooldownMinutes: 2 * 60,
    maxDurationMinutes: 2 * 60,
} as const

export const SEED_LIMITS = {
    liveFrom: { min: 2, max: 250 },
    startBelow: { min: 1, max: 249 },
    pingWindowMinutes: { min: 60, max: 7 * 24 * 60 },
    cooldownMinutes: { min: 30, max: 24 * 60 },
    maxDurationMinutes: { min: 15, max: 12 * 60 },
    scheduleSlots: 7,
} as const

export type SeedEndAction = "edit" | "delete"

/** One weekly slot: the chosen weekdays (0 = Sunday … 6 = Saturday) at one local time. */
export type SeedScheduleSlot = { days: number[]; time: string }

export type SeedPlanSettings = {
    enabled: boolean
    /** The server is live from this many players; a running seed ends there. */
    liveFrom: number
    /** Scheduled and automatic seeds start only below this many players. */
    startBelow: number
    schedule: { enabled: boolean; slots: SeedScheduleSlot[] }
    /** Start when the server drops below `below` players between `from` and `to` (local time). */
    auto: { enabled: boolean; below: number; from: string; to: string }
    seedChannelId: string | null
    /** The private admin channel with one "Ovládání serveru" message per server. */
    controlChannelId: string | null
    seedRoleId: string | null
    /** Players toggle the Seed role themselves with "Zvát mě na seed". */
    roleSelfService: boolean
    /** At most one Seed role ping in this window; a seed inside it runs without a ping. */
    pingWindowMinutes: number
    /** Minimum time between two seed starts on this server. */
    cooldownMinutes: number
    /** A seed ends after this long even below the live threshold. */
    maxDurationMinutes: number
    /** Admin call text; null uses the clan-language default. */
    template: string | null
    /** At the live threshold: edit the call to "Server je živý" or delete it. */
    endAction: SeedEndAction
}

export function defaultSeedPlanSettings(): SeedPlanSettings {
    return {
        enabled: false,
        liveFrom: SEED_DEFAULTS.liveFrom,
        startBelow: SEED_DEFAULTS.startBelow,
        schedule: {
            enabled: false,
            slots: [
                {
                    days: [...SEED_DEFAULTS.scheduleDays],
                    time: SEED_DEFAULTS.scheduleTime,
                },
            ],
        },
        auto: {
            enabled: false,
            below: SEED_DEFAULTS.autoBelow,
            from: SEED_DEFAULTS.autoFrom,
            to: SEED_DEFAULTS.autoTo,
        },
        seedChannelId: null,
        controlChannelId: null,
        seedRoleId: null,
        roleSelfService: true,
        pingWindowMinutes: SEED_DEFAULTS.pingWindowMinutes,
        cooldownMinutes: SEED_DEFAULTS.cooldownMinutes,
        maxDurationMinutes: SEED_DEFAULTS.maxDurationMinutes,
        template: null,
        endAction: "edit",
    }
}

/** Runtime memory of a plan, written only by the seed workflows. */
export type SeedPlanState = {
    /** Hysteresis memory: live from `liveFrom`, not live again only below `startBelow`. */
    phase: "live" | "not_live" | null
    lastStartedAt: number | null
    lastPingAt: number | null
    /** Last time a fresh reading showed at least `liveFrom` players. */
    lastLiveAt: number | null
    lastAutoStartAt: number | null
    /** The last schedule occurrence that was decided (started or skipped). */
    consumedOccurrence: string | null
    activeRunId: string | null
}

export function initialSeedPlanState(): SeedPlanState {
    return {
        phase: null,
        lastStartedAt: null,
        lastPingAt: null,
        lastLiveAt: null,
        lastAutoStartAt: null,
        consumedOccurrence: null,
        activeRunId: null,
    }
}

export type SeedPlanIssueCode =
    | "invalid"
    | "start_below_not_under_live"
    | "auto_below_above_start"
    | "auto_window_empty"
    | "schedule_without_slots"
    | "duplicate_day"
    | "duplicate_slot"
    | "seed_channel_required"
    | "control_channel_same_as_seed"
    | "unknown_placeholder"
    | "live_above_capacity"

const snowflake = z.string().regex(/^\d{17,20}$/)
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const weekday = z.number().int().min(0).max(6)
const whole = (limits: { min: number; max: number }) =>
    z.number().int().min(limits.min).max(limits.max)

const issue = (
    ctx: z.RefinementCtx,
    path: (string | number)[],
    code: SeedPlanIssueCode
) => ctx.addIssue({ code: "custom", message: code, path })

/** Shape, ranges and cross-field rules of a plan as an admin submits it. */
export const seedPlanSettingsSchema = z
    .strictObject({
        enabled: z.boolean(),
        liveFrom: whole(SEED_LIMITS.liveFrom),
        startBelow: whole(SEED_LIMITS.startBelow),
        schedule: z.strictObject({
            enabled: z.boolean(),
            slots: z
                .array(
                    z.strictObject({
                        days: z.array(weekday).min(1).max(7),
                        time: clock,
                    })
                )
                .max(SEED_LIMITS.scheduleSlots),
        }),
        auto: z.strictObject({
            enabled: z.boolean(),
            below: whole(SEED_LIMITS.startBelow),
            from: clock,
            to: clock,
        }),
        seedChannelId: snowflake.nullable(),
        controlChannelId: snowflake.nullable(),
        seedRoleId: snowflake.nullable(),
        roleSelfService: z.boolean(),
        pingWindowMinutes: whole(SEED_LIMITS.pingWindowMinutes),
        cooldownMinutes: whole(SEED_LIMITS.cooldownMinutes),
        maxDurationMinutes: whole(SEED_LIMITS.maxDurationMinutes),
        template: z
            .string()
            .trim()
            .max(SEED_TEMPLATE_MAX_LENGTH)
            .nullable()
            .transform((value) => (value ? value : null)),
        endAction: z.enum(["edit", "delete"]),
    })
    .superRefine((plan, ctx) => {
        if (plan.startBelow >= plan.liveFrom)
            issue(ctx, ["startBelow"], "start_below_not_under_live")
        if (plan.auto.below > plan.startBelow)
            issue(ctx, ["auto", "below"], "auto_below_above_start")
        if (plan.auto.from === plan.auto.to)
            issue(ctx, ["auto", "to"], "auto_window_empty")
        if (plan.schedule.enabled && plan.schedule.slots.length === 0)
            issue(ctx, ["schedule", "slots"], "schedule_without_slots")
        const seen = new Set<string>()
        plan.schedule.slots.forEach((slot, index) => {
            if (new Set(slot.days).size !== slot.days.length)
                issue(
                    ctx,
                    ["schedule", "slots", index, "days"],
                    "duplicate_day"
                )
            for (const day of new Set(slot.days)) {
                const key = `${day}@${slot.time}`
                if (seen.has(key))
                    issue(ctx, ["schedule", "slots", index], "duplicate_slot")
                seen.add(key)
            }
        })
        if (plan.enabled && !plan.seedChannelId)
            issue(ctx, ["seedChannelId"], "seed_channel_required")
        if (
            plan.controlChannelId &&
            plan.controlChannelId === plan.seedChannelId
        )
            issue(ctx, ["controlChannelId"], "control_channel_same_as_seed")
        if (
            plan.template &&
            unknownSeedTemplatePlaceholders(plan.template).length > 0
        )
            issue(ctx, ["template"], "unknown_placeholder")
    })
    .transform((plan): SeedPlanSettings => ({
        ...plan,
        schedule: {
            enabled: plan.schedule.enabled,
            slots: plan.schedule.slots.map((slot) => ({
                days: [...slot.days].sort((a, b) => a - b),
                time: slot.time,
            })),
        },
    }))

export type SeedPlanIssue = { path: string; code: SeedPlanIssueCode }
export type SeedPlanParse =
    | { ok: true; plan: SeedPlanSettings }
    | { ok: false; issues: SeedPlanIssue[] }

const CODES = new Set<string>([
    "start_below_not_under_live",
    "auto_below_above_start",
    "auto_window_empty",
    "schedule_without_slots",
    "duplicate_day",
    "duplicate_slot",
    "seed_channel_required",
    "control_channel_same_as_seed",
    "unknown_placeholder",
])

/** Validates untrusted plan input; every problem is reported by path and a stable code. */
export function parseSeedPlanSettings(input: unknown): SeedPlanParse {
    const parsed = seedPlanSettingsSchema.safeParse(input)
    if (parsed.success) return { ok: true, plan: parsed.data }
    return {
        ok: false,
        issues: parsed.error.issues.map((entry) => ({
            path: entry.path.map(String).join("."),
            code: (CODES.has(entry.message)
                ? entry.message
                : "invalid") as SeedPlanIssueCode,
        })),
    }
}

/**
 * A server can never reach a live threshold above its capacity; checked when
 * the capacity is known from the provider.
 */
export function seedPlanCapacityIssues(
    plan: Pick<SeedPlanSettings, "liveFrom">,
    capacity: number | null
): SeedPlanIssue[] {
    return capacity !== null && plan.liveFrom > capacity
        ? [{ path: "liveFrom", code: "live_above_capacity" }]
        : []
}

/** The thresholds a running seed keeps, read from the plan at start. */
export type SeedThresholds = Pick<SeedPlanSettings, "liveFrom" | "startBelow">
