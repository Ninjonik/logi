import { z } from "zod"
const text = z.string().trim().min(1).max(200)
export const reportChoiceSchema = z.strictObject({
    name: text,
    playerId: text.nullable(),
    team: text.nullable(),
})
export const reportObservationSchema = z.strictObject({
    map: text.nullable(),
    observedAt: z.iso.datetime().nullable(),
    serverName: text.nullable(),
    players: z.array(reportChoiceSchema).max(300),
})
export const reportSubmissionSchema = z
    .strictObject({
        choice: z.number().int().min(-1).max(299),
        manualPlayer: z.string().trim().max(200).default(""),
        reason: z.string().trim().min(10).max(1000),
        incident: z.string().trim().max(100).default(""),
        evidence: z
            .string()
            .trim()
            .max(1000)
            .default("")
            .refine((value) => {
                if (!value) return true
                try {
                    const url = new URL(value)
                    return (
                        url.protocol === "https:" &&
                        !url.username &&
                        !url.password &&
                        !/[\r\n]/.test(value)
                    )
                } catch {
                    return false
                }
            }),
    })
    .superRefine((value, ctx) => {
        if (value.choice === -1 && !value.manualPlayer)
            ctx.addIssue({
                code: "custom",
                message: "Player name or ID is required",
                path: ["manualPlayer"],
            })
    })
export type ReportObservation = z.infer<typeof reportObservationSchema>
export type ReportSubmission = z.infer<typeof reportSubmissionSchema>
export function resolveReportPlayer(
    observation: ReportObservation,
    input: ReportSubmission
) {
    if (input.choice === -1)
        return {
            name: input.manualPlayer,
            playerId: null,
            team: null,
            provenance: "manual_unverified" as const,
        }
    const player = observation.players[input.choice]
    if (!player) throw new Error("Invalid report selection.")
    return { ...player, provenance: "observed" as const }
}
