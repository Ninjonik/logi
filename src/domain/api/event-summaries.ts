import { z } from "zod"

import { GAME_IDS, resolveGameScope } from "../games/game"
import type { EventLike } from "../events/types"

const identity = {
    id: z.string(),
    guildId: z.string(),
    gameId: z.enum(GAME_IDS),
    title: z.string(),
    updatedAt: z.string().nullable(),
}

/** Authenticated, minimized operational data; publication remains consumer-owned. */
export const clanEventSummarySchema = z
    .object({
        ...identity,
        kind: z.enum(["match", "training"]),
        status: z
            .enum(["registration", "closed", "starting", "concluded"])
            .nullable(),
        startsAt: z.string().nullable(),
        endsAt: z.string(),
    })
    .strict()

export const clanMatchSummarySchema = z
    .object({
        ...identity,
        eventId: z.string(),
        resultState: z.enum(["unknown", "provisional"]),
        result: z
            .object({
                mapId: z.string(),
                mapName: z.string().nullable(),
                sideA: z.string(),
                sideB: z.string(),
                score: z
                    .object({ sideA: z.number(), sideB: z.number() })
                    .strict(),
                outcome: z.enum(["victory", "defeat", "draw"]),
                endedAt: z.string().nullable(),
                provenance: z
                    .object({
                        type: z.literal("event_result_import"),
                        importedAt: z.string(),
                    })
                    .strict(),
            })
            .strict()
            .nullable(),
    })
    .strict()

export type ClanEventSummary = z.infer<typeof clanEventSummarySchema>
export type ClanMatchSummary = z.infer<typeof clanMatchSummarySchema>

type SummaryEvent = Pick<
    EventLike,
    | "gameId"
    | "kind"
    | "status"
    | "gameStart"
    | "gameEnd"
    | "updatedAt"
    | "eventResult"
> & {
    _id: string
    guildId: string
    name: string
}

function summaryIdentity(event: SummaryEvent) {
    return {
        id: event._id,
        guildId: event.guildId,
        gameId: resolveGameScope(event.gameId),
        title: event.name,
        updatedAt: event.updatedAt ?? null,
    }
}

export function projectEventSummary(event: SummaryEvent): ClanEventSummary {
    return clanEventSummarySchema.parse({
        ...summaryIdentity(event),
        kind: event.kind ?? "match",
        status: event.status ?? null,
        startsAt: event.gameStart ?? null,
        endsAt: event.gameEnd,
    })
}

export function projectMatchSummary(event: SummaryEvent): ClanMatchSummary {
    const result = event.eventResult
    return clanMatchSummarySchema.parse({
        ...summaryIdentity(event),
        eventId: event._id,
        resultState: result ? "provisional" : "unknown",
        result: result
            ? {
                  mapId: result.mapId,
                  mapName: result.mapName ?? null,
                  sideA: result.sideA,
                  sideB: result.sideB,
                  score: {
                      sideA: result.score.sideA,
                      sideB: result.score.sideB,
                  },
                  outcome: result.outcome,
                  endedAt: result.endedAt ?? null,
                  provenance: {
                      type: "event_result_import",
                      importedAt: result.importedAt,
                  },
              }
            : null,
    })
}
