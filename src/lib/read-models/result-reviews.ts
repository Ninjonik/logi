import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"
import { z } from "zod"

import {
    toMatchListResultReview,
    type MatchListResultReview,
} from "@/domain/events/match-list"
import { getInternalAuthSecret } from "@/lib/env"

const listClanReviewsReference = makeFunctionReference<"query">(
    "eventResults:listClanReviews"
)

const clanReviewSchema = z.object({
    eventId: z.string(),
    status: z.enum(["provisional", "confirmed", "corrected"]),
    origin: z.enum(["collected", "manual", "legacy_import"]),
    participants: z.array(z.object({ score: z.number().nullable() })),
})

/** Parses the stored heads; rows that do not match are left out. */
export function parseClanResultReviews(rows: unknown) {
    const reviews = new Map<string, MatchListResultReview>()
    if (!Array.isArray(rows)) return reviews
    for (const row of rows) {
        const parsed = clanReviewSchema.safeParse(row)
        if (parsed.success)
            reviews.set(
                parsed.data.eventId,
                toMatchListResultReview(parsed.data)
            )
    }
    return reviews
}

/**
 * Result review state of a clan's matches, for the match list of a person who
 * manages the clan (the caller checks that). Read fresh on every request so a
 * confirmed result leaves the "waiting for you" list at once. Empty when it
 * cannot be read, for example before the deployment has the query.
 */
export async function getClanResultReviews(
    guildDiscordId: string
): Promise<Map<string, MatchListResultReview>> {
    try {
        return parseClanResultReviews(
            await fetchQuery(listClanReviewsReference, {
                secret: getInternalAuthSecret(),
                guildId: guildDiscordId,
            })
        )
    } catch {
        return new Map()
    }
}
