import { z } from "zod"
const games = z
    .array(
        z.strictObject({
            gameId: z.string().min(1),
            roleIds: z
                .array(z.string().regex(/^\d{17,20}$/))
                .max(100)
                .refine((ids) => new Set(ids).size === ids.length),
        })
    )
    .min(1)
    .max(64)
    .refine(
        (values) =>
            new Set(values.map((value) => value.gameId)).size === values.length
    )
export const membershipPolicyInputSchema = z.strictObject({
    apiKeyId: z.string().min(1).max(128),
    enabled: z.boolean(),
    games,
})
export type MembershipPolicyInput = z.infer<typeof membershipPolicyInputSchema>
export const membershipPolicySettingsSchema = z.array(
    z.strictObject({
        apiKeyId: z.string(),
        name: z.string(),
        gameIds: z.array(z.string().min(1)),
        policy: z
            .strictObject({ enabled: z.boolean(), games, version: z.string() })
            .nullable(),
    })
)
export type MembershipPolicySettings = z.infer<
    typeof membershipPolicySettingsSchema
>
