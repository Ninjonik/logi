import { z } from "zod"

import {
    defaultSeedPlanSettings,
    SEED_LIMITS,
    type SeedPlanIssue,
    type SeedPlanSettings,
} from "../discord-seed/plan"
import { SEED_TEMPLATE_MAX_LENGTH } from "../discord-seed/template"

import { defineClanSettingsSlice } from "./settings-slices"

/**
 * `/api/v1` clan settings slice `seed` ("Seed serverů", board P3): the seed
 * plan of each game server of the clan, with the private control channel.
 * The live actions "Seed teď" and "Ukončit seed" (dashboard and Discord) are
 * deliberately not part of the API, see `configuration-coverage.md`.
 *
 * The dashboard checks the channels in Discord before it saves. The API
 * cannot: the bot then refuses to post the control message into a channel
 * `@everyone` can see and reports it in the clan's errors channel.
 */

const snowflake = z.string().regex(/^\d{17,20}$/)
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const whole = (limits: { min: number; max: number }) =>
    z.number().int().min(limits.min).max(limits.max)

const schedule = z.strictObject({
    enabled: z.boolean(),
    slots: z
        .array(
            z.strictObject({
                /** Weekdays, 0 = Sunday … 6 = Saturday. */
                days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
                /** Local time in the clan's time zone, `HH:MM`. */
                time: clock,
            })
        )
        .max(SEED_LIMITS.scheduleSlots),
})
const auto = z.strictObject({
    enabled: z.boolean(),
    below: whole(SEED_LIMITS.startBelow),
    from: clock,
    to: clock,
})

/** One server's plan as GET shows it. */
export const seedPlanApiSettingsSchema = z.object({
    enabled: z.boolean(),
    liveFrom: z.number().int(),
    startBelow: z.number().int(),
    schedule: z.object({
        enabled: z.boolean(),
        slots: z.array(
            z.object({ days: z.array(z.number().int()), time: z.string() })
        ),
    }),
    auto: z.object({
        enabled: z.boolean(),
        below: z.number().int(),
        from: z.string(),
        to: z.string(),
    }),
    seedChannelId: z.string().nullable(),
    controlChannelId: z.string().nullable(),
    seedRoleId: z.string().nullable(),
    roleSelfService: z.boolean(),
    pingWindowMinutes: z.number().int(),
    cooldownMinutes: z.number().int(),
    maxDurationMinutes: z.number().int(),
    template: z.string().nullable(),
    endAction: z.enum(["edit", "delete"]),
}) satisfies z.ZodType<SeedPlanSettings>

export const seedSettingsApiSchema = z.object({
    servers: z.array(
        z.object({
            connectionId: z.string(),
            gameId: z.enum(["hell_let_loose", "wardogs"]),
            name: z.string().nullable(),
            /** False until the first save; `settings` are then the defaults. */
            configured: z.boolean(),
            /** Pass as `expectedRevision` to refuse a concurrent change. */
            revision: z.number().int().nullable(),
            settings: seedPlanApiSettingsSchema,
        })
    ),
})
export type SeedSettingsApiView = z.infer<typeof seedSettingsApiSchema>

/**
 * The fields a PATCH may change; the rest of the stored plan stays. The
 * merged plan is validated as a whole, with the same rules as the dashboard.
 */
export const seedPlanPatchSchema = z.strictObject({
    enabled: z.boolean().optional(),
    liveFrom: whole(SEED_LIMITS.liveFrom).optional(),
    startBelow: whole(SEED_LIMITS.startBelow).optional(),
    schedule: schedule.optional(),
    auto: auto.optional(),
    seedChannelId: snowflake.nullable().optional(),
    controlChannelId: snowflake.nullable().optional(),
    seedRoleId: snowflake.nullable().optional(),
    roleSelfService: z.boolean().optional(),
    pingWindowMinutes: whole(SEED_LIMITS.pingWindowMinutes).optional(),
    cooldownMinutes: whole(SEED_LIMITS.cooldownMinutes).optional(),
    maxDurationMinutes: whole(SEED_LIMITS.maxDurationMinutes).optional(),
    template: z.string().max(SEED_TEMPLATE_MAX_LENGTH).nullable().optional(),
    endAction: z.enum(["edit", "delete"]).optional(),
})
export type SeedPlanPatch = z.infer<typeof seedPlanPatchSchema>

export const seedSettingsPatchSchema = z.strictObject({
    servers: z
        .array(
            z.strictObject({
                connectionId: z.string().min(1).max(100),
                /** The plan's `revision` from GET; null for a plan never saved. Omit to overwrite. */
                expectedRevision: z.number().int().min(0).nullable().optional(),
                settings: seedPlanPatchSchema,
            })
        )
        .min(1)
        .max(20)
        .refine(
            (servers) =>
                new Set(servers.map((server) => server.connectionId)).size ===
                servers.length,
            "Each server may appear once."
        ),
})
export type SeedSettingsPatch = z.infer<typeof seedSettingsPatchSchema>

/** The stored plan (or the defaults) with the supplied fields replaced. */
export function mergeSeedPlanPatch(
    current: SeedPlanSettings | null,
    patch: SeedPlanPatch
): Record<string, unknown> {
    const merged: Record<string, unknown> = {
        ...(current ?? defaultSeedPlanSettings()),
    }
    for (const [key, value] of Object.entries(patch))
        if (value !== undefined) merged[key] = value
    return merged
}

export type SeedSettingsApiError = {
    status: number
    code: string
    message: string
}

/** Plain-language API errors of the slice's store. */
export function seedSettingsApiError(
    error:
        | { kind: "unknown_server"; index: number }
        | { kind: "conflict"; index: number }
        | { kind: "invalid"; index: number; issues: SeedPlanIssue[] }
): SeedSettingsApiError {
    const at = `seed.servers.${error.index}`
    switch (error.kind) {
        case "unknown_server":
            return {
                status: 400,
                code: "validation_error",
                message: `${at}.connectionId: unknown game server connection.`,
            }
        case "conflict":
            return {
                status: 409,
                code: "conflict",
                message: `${at}.expectedRevision: the seed plan changed since that revision.`,
            }
        case "invalid": {
            const issue = error.issues[0]
            return {
                status: 400,
                code: "validation_error",
                message: `${at}.settings${issue?.path ? `.${issue.path}` : ""}: ${issue?.code ?? "invalid"}.`,
            }
        }
    }
}

const EMPTY: SeedSettingsApiView = { servers: [] }

export const seedSettingsSlice = defineClanSettingsSlice({
    key: "seed",
    description:
        "Server seeding: per game server, when the server counts as live, when a seed may start (schedule and automatic start), the seed channel, the opt-in Seed role, ping protection, the minimum time between seeds, the maximum duration, the call text, what happens at the threshold and the private control channel. Starting and ending a seed are live Discord actions and not part of the API.",
    schema: seedSettingsApiSchema,
    patchSchema: seedSettingsPatchSchema,
    external: true,
    read: ({ external }) => {
        const parsed = seedSettingsApiSchema.safeParse(external?.seed)
        return parsed.success ? parsed.data : EMPTY
    },
    // Stored in `discordSeedPlans` by `convex/clanSettingsStores.ts`.
    toPatch: () => ({}),
})
