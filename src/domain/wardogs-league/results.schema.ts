import { z } from "zod"

/**
 * Zod schema of a stored League result, for the website and tests. The
 * builders and selections stay in `results.ts`, which the panel reads walk
 * without Zod.
 */
const text = z.string().min(1).max(500)
/**
 * One League result as Logi keeps it for the table and recent results. It is
 * derived from a parsed match snapshot and never verified by Logi: the clan's
 * confirmed results live in its own events.
 */
export const leagueResultRecordSchema = z
    .object({
        matchId: text,
        sourceUrl: z.url(),
        fixtureNumber: z.number().int().nonnegative().nullable(),
        type: text.nullable(),
        /** Kickoff, or when Logi first saw the result if kickoff is unknown. */
        occurredAt: z.iso.datetime(),
        season: z.string().regex(/^\d{4}$/),
        pointsRule: z.array(z.number().int().nonnegative()).min(1).max(20),
        pointsRuleSource: z.enum(["published", "default"]),
        confirmed: z.boolean(),
        placements: z
            .array(
                z.object({
                    place: z.number().int().min(1).max(20),
                    teamCode: text,
                    teamName: text.nullable(),
                    faction: text.nullable(),
                })
            )
            .min(1)
            .max(20),
    })
    .strict()
export type LeagueResultRecord = z.infer<typeof leagueResultRecordSchema>
