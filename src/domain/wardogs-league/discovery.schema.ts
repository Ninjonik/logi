import { z } from "zod"

/** Zod schema of a workspace's Wardogs League settings; the cadences and matching rules stay in `discovery.ts`. */
const channel = z
    .string()
    .regex(/^\d{17,20}$/)
    .nullable()
export const trackingSettingsSchema = z
    .object({
        enabled: z.boolean(),
        teamCodes: z
            .array(
                z
                    .string()
                    .min(1)
                    .max(40)
                    .regex(/^[\p{L}\p{N}|_-]+$/u)
            )
            .min(1)
            .max(20)
            .refine((v) => new Set(v).size === v.length),
        inputChannelId: channel,
        outputChannelId: channel,
        scanMinutes: z
            .union([z.literal(15), z.literal(30), z.literal(60)])
            .default(15),
        refreshMinutes: z.union([z.literal(15), z.literal(30)]).default(15),
    })
    .strict()
export type TrackingSettings = z.infer<typeof trackingSettingsSchema>
