import { GAME_IDS } from "../games/game"
import { z } from "zod"

const status = z.enum([
    "pending",
    "running",
    "retry_scheduled",
    "applied",
    "denied",
    "superseded",
    "failed",
])
const reason = z.string().regex(/^[a-z_]{1,64}$/)
const snowflake = z.string().regex(/^\d{17,20}$/)
export const memberRoleOperationsSchema = z
    .array(
        z
            .object({
                id: z.string().min(1).max(256),
                gameId: z.enum(GAME_IDS),
                userId: z.string().min(1).max(256),
                actorId: snowflake,
                provenance: z.enum([
                    "dashboard",
                    "recruitment",
                    "application",
                    "rollback",
                ]),
                version: z.number().int().positive(),
                status,
                attempts: z.number().int().nonnegative(),
                reason,
                updatedAt: z.iso.datetime(),
                audit: z
                    .array(
                        z
                            .object({
                                attempt: z.number().int().positive(),
                                outcome: status,
                                reason,
                                at: z.iso.datetime(),
                            })
                            .strict()
                    )
                    .max(5),
            })
            .strict()
    )
    .max(100)
export type MemberRoleOperations = z.infer<typeof memberRoleOperationsSchema>
