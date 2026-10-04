import { providerSessionSchema } from "./contracts"
import { z } from "zod"

const revision = z.string().regex(/^(0|[1-9][0-9]{0,127})$/)
export const retainedWarconSessionSchema = providerSessionSchema.refine(
    (session) =>
        session.complete &&
        session.startedAt !== null &&
        session.endedAt !== null &&
        Date.parse(session.endedAt) >= Date.parse(session.startedAt) &&
        session.warcon !== undefined &&
        new Set(
            session.players.map(
                (player) => `${player.platform}:${player.platformId}`
            )
        ).size === session.players.length &&
        new Set(session.participants.map((faction) => faction.id)).size ===
            session.participants.length &&
        (session.warcon.winner === null ||
            session.participants.length === 0 ||
            session.participants.some(
                (faction) => faction.id === session.warcon!.winner
            )),
    { message: "Invalid retained Warcon session." }
)
export const historyRecordSchema = z.strictObject({
    schemaVersion: z.literal(1),
    id: z.string(),
    guildId: z.string(),
    gameId: z.literal("wardogs"),
    provider: z.literal("wardogs_warcon"),
    sourceId: z.string().regex(/^[a-f0-9]{64}$/),
    serverName: z.string().max(200).nullable(),
    revision,
    collectedAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    session: retainedWarconSessionSchema,
})
export type HistoryRecord = z.infer<typeof historyRecordSchema>
export const historyPageSchema = z.strictObject({
    items: z.array(historyRecordSchema).max(20),
    revision,
    nextCursor: z.string().max(8192).nullable(),
    lastCollectedAt: z.iso.datetime().nullable(),
})
export type HistoryPage = z.infer<typeof historyPageSchema>

export const historyFiltersSchema = z
    .strictObject({
        sourceId: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .optional(),
        map: z.string().min(1).max(200).optional(),
        from: z.iso
            .datetime()
            .transform((value) => new Date(value).toISOString())
            .optional(),
        until: z.iso
            .datetime()
            .transform((value) => new Date(value).toISOString())
            .optional(),
    })
    .refine(
        (value) =>
            !value.from ||
            !value.until ||
            Date.parse(value.from) < Date.parse(value.until)
    )
export type HistoryFilters = z.infer<typeof historyFiltersSchema>
