import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"
import { z } from "zod"

import { getInternalAuthSecret } from "@/lib/env"

const listClanFixtureLabelsReference = makeFunctionReference<"query">(
    "competitions:listClanFixtureLabels"
)

const fixtureLabelSchema = z.object({
    eventId: z.string(),
    name: z.string(),
    season: z.string(),
    phase: z.enum(["league", "playoff", "relegation"]),
})

/** The published competition a match is played in. */
export type MatchCompetitionLabel = Omit<
    z.infer<typeof fixtureLabelSchema>,
    "eventId"
>

/** Parses the labels by event; rows that do not match are left out. */
export function parseClanFixtureLabels(rows: unknown) {
    const labels = new Map<string, MatchCompetitionLabel>()
    if (!Array.isArray(rows)) return labels
    for (const row of rows) {
        const parsed = fixtureLabelSchema.safeParse(row)
        if (!parsed.success) continue
        const { eventId, ...label } = parsed.data
        labels.set(eventId, label)
    }
    return labels
}

/**
 * Competitions of a clan's matches for the match list. Only published
 * competitions are returned, so members may see them too. Empty when they
 * cannot be read, for example before the deployment has the query.
 */
export async function getClanFixtureLabels(
    guildDiscordId: string
): Promise<Map<string, MatchCompetitionLabel>> {
    try {
        return parseClanFixtureLabels(
            await fetchQuery(listClanFixtureLabelsReference, {
                secret: getInternalAuthSecret(),
                guildId: guildDiscordId,
            })
        )
    } catch {
        return new Map()
    }
}
