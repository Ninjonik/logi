import {
    SEED_LIMITS,
    type SeedPlanIssueCode,
    type SeedPlanParse,
    type SeedPlanSettings,
} from "./plan"
import {
    SEED_TEMPLATE_MAX_LENGTH,
    unknownSeedTemplatePlaceholders,
} from "./template"
import { z } from "zod"

/**
 * Zod validation of a seed plan as an admin submits it. The plan's defaults,
 * limits, types and state helpers stay in `plan.ts`, which the seed tick and
 * the bot's seed reads walk without Zod.
 */
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
