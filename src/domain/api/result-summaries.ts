import type { ResultRevision } from "../match-results/result-revision"
import { providerSchema, scoreSchema } from "../game-data/contracts"
import { GAME_IDS, resolveGameScope } from "../games/game"
import { z } from "zod"
export const resultSummaryPayloadSchema = z
    .object({
        version: z.number().int().positive(),
        status: z.enum(["provisional", "confirmed", "corrected"]),
        participants: z.array(scoreSchema).min(2).max(16),
        provenance: z
            .object({
                origin: z.enum(["collected", "manual", "legacy_import"]),
                sources: z
                    .array(
                        z
                            .object({
                                provider: providerSchema,
                                complete: z.boolean(),
                                startedAt: z.iso.datetime().nullable(),
                                endedAt: z.iso.datetime().nullable(),
                            })
                            .strict()
                    )
                    .max(4),
            })
            .strict(),
        reviewedAt: z.iso.datetime().nullable(),
        supersedesVersion: z.number().int().positive().nullable(),
        attribution: z
            .object({
                verified: z.number().int().nonnegative(),
                unresolved: z.number().int().nonnegative(),
            })
            .strict(),
    })
    .strict()
export const clanResultSummarySchema = z
    .object({
        id: z.string(),
        eventId: z.string(),
        guildId: z.string(),
        gameId: z.enum(GAME_IDS),
        title: z.string(),
        updatedAt: z.string().nullable(),
        resultState: z.enum([
            "unknown",
            "provisional",
            "confirmed",
            "corrected",
        ]),
        result: resultSummaryPayloadSchema.nullable(),
    })
    .strict()
export type ResultSummaryPayload = z.infer<typeof resultSummaryPayloadSchema>
export function resultSummaryPayload(
    revision: ResultRevision
): ResultSummaryPayload {
    return resultSummaryPayloadSchema.parse({
        version: revision.version,
        status: revision.status,
        participants: revision.participants,
        provenance: {
            origin: revision.origin,
            sources: revision.sessionLinks.map(
                ({ provider, complete, startedAt, endedAt }) => ({
                    provider,
                    complete,
                    startedAt,
                    endedAt,
                })
            ),
        },
        reviewedAt: revision.reviewedAt,
        supersedesVersion: revision.supersedesVersion,
        attribution: {
            verified: revision.players.filter((p) => p.logiUserId !== null)
                .length,
            unresolved: revision.players.filter((p) => p.logiUserId === null)
                .length,
        },
    })
}
export function projectResultSummary(event: {
    _id: string
    guildId: string
    gameId?: (typeof GAME_IDS)[number]
    name: string
    updatedAt?: string
    reviewedResultGameId?: string
    reviewedResult?: ResultSummaryPayload
}) {
    const gameId = resolveGameScope(event.gameId)
    const result =
        event.reviewedResultGameId === gameId
            ? (event.reviewedResult ?? null)
            : null
    return clanResultSummarySchema.parse({
        id: event._id,
        eventId: event._id,
        guildId: event.guildId,
        gameId,
        title: event.name,
        updatedAt: event.updatedAt ?? null,
        resultState: result?.status ?? "unknown",
        result,
    })
}
