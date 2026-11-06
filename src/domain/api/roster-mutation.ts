import { z } from "zod"

const playerSchema = z.object({
    allocatedGuildId: z.string().min(1).max(200).optional(),
    locked: z.boolean().optional(),
    id: z.string().optional(),
    customName: z.string().optional(),
    ack: z.boolean(),
    confirmed: z.boolean().optional(),
    note: z.string().optional(),
    roleName: z.string().optional(),
    roleIcon: z.string().optional(),
})

export const rosterMutationSchema = z.object({
    expectedUpdatedAt: z.string().optional(),
    eventId: z.string().min(1),
    squadPresetId: z.string().optional(),
    squads: z.array(
        z.object({
            name: z.string(),
            group: z.string(),
            order: z.number(),
            color: z.string(),
            icon: z.string().optional(),
            players: z.array(playerSchema),
        })
    ),
    reservePlayerIds: z.array(z.string()),
    reserveAttendances: z
        .array(
            z.object({
                userId: z.string(),
                ack: z.boolean(),
                confirmed: z.boolean().optional(),
            })
        )
        .optional(),
    notAttendingPlayerIds: z.array(z.string()),
    streamerId: z.string().optional(),
    published: z.boolean(),
})
