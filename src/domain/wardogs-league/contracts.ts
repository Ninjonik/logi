import { z } from "zod"

export const PARSER_VERSION = "wardogs-league-html/1"
export const CACHE_MS = 5 * 60_000
export const LEASE_MS = 25_000
export const MAX_RETRY_AFTER_MS = 24 * 60 * 60_000
const text = z.string().min(1).max(500)
const nullableText = text.nullable()
const timestamp = z.iso.datetime()
const count = z.number().int().nonnegative().nullable()
const choice = z.object({ teamCode: text, value: nullableText })
/**
 * Finishing places the League publishes for a completed fixture. Parser
 * version 1 never produces it: no completed match page has been captured yet
 * (see `src/infrastructure/wardogs-league/parse-results.ts`). Places may tie;
 * a team finishes at most once. Points are not stored: Logi derives them from
 * the published scoring rule (`scoring.ts`).
 */
export const leagueResultsSchema = z
    .object({
        placements: z
            .array(
                z.object({
                    place: z.number().int().min(1).max(20),
                    teamCode: text,
                })
            )
            .min(1)
            .max(20),
        /** The League's own "Confirmed" step is done; unconfirmed places may still change. */
        confirmed: z.boolean(),
    })
    .refine(
        (value) =>
            new Set(value.placements.map((entry) => entry.teamCode)).size ===
            value.placements.length,
        { message: "A team can finish only once." }
    )
export type LeagueResults = z.infer<typeof leagueResultsSchema>
export const leagueMatchSchema = z.object({
    id: text,
    sourceUrl: z.url(),
    parserVersion: z.literal(PARSER_VERSION),
    title: text,
    fixtureNumber: count,
    type: nullableText,
    status: nullableText,
    scheduledAt: timestamp.nullable(),
    request: z.object({ number: count, url: z.url() }).nullable(),
    teams: z
        .array(
            z.object({
                code: text,
                name: nullableText,
                profileUrl: z.url(),
                nations: z.array(text).max(30).nullable(),
                displayedMemberCount: count,
                faction: nullableText,
                readyCheck: nullableText,
            })
        )
        .max(20)
        .nullable(),
    map: z
        .object({
            name: nullableText,
            zone: nullableText,
            lighting: nullableText,
        })
        .nullable(),
    hosting: z
        .object({ mode: nullableText, teamCode: nullableText })
        .nullable(),
    moderator: nullableText,
    mapVote: z
        .object({
            status: nullableText,
            closesAt: timestamp.nullable(),
            ballots: z.array(choice).max(20).nullable(),
        })
        .nullable(),
    rules: z
        .object({
            summary: nullableText,
            choices: z.array(choice).max(20).nullable(),
        })
        .nullable(),
    readyCheck: nullableText,
    progress: z
        .array(
            z.object({
                label: text,
                state: z.enum(["done", "current", "not_started"]).nullable(),
                detail: nullableText,
            })
        )
        .max(30)
        .nullable(),
    scoringRule: nullableText,
    results: leagueResultsSchema.nullable(),
    warnings: z.array(text).max(100),
})
export type LeagueMatch = z.infer<typeof leagueMatchSchema>
export const leagueSnapshotSchema = leagueMatchSchema.extend({
    fetchedAt: timestamp,
})
export type LeagueSnapshot = z.infer<typeof leagueSnapshotSchema>
export const leagueErrorSchema = z.enum([
    "rate_limited",
    "timeout",
    "network",
    "http",
    "invalid_html",
    "unsafe_redirect",
    "too_large",
    "refresh_in_progress",
])
export type LeagueErrorCode = z.infer<typeof leagueErrorSchema>
export class LeagueError extends Error {
    constructor(
        public readonly code: LeagueErrorCode,
        public readonly retryAfterMs?: number
    ) {
        super(code)
    }
}
export const leagueReadSchema = z.object({
    snapshot: leagueSnapshotSchema.nullable(),
    stale: z.boolean(),
    ageSeconds: z.number().int().nonnegative().nullable(),
    lastAttemptAt: timestamp.nullable(),
    nextRefreshAt: timestamp,
    error: leagueErrorSchema.nullable(),
})
export type LeagueRead = z.infer<typeof leagueReadSchema>

/** Losing previously observed structure is a refresh failure, not a new empty match. */
export function losesMatchStructure(previous: LeagueMatch, next: LeagueMatch) {
    const lostFields = <T extends object>(before: T | null, after: T | null) =>
        before !== null &&
        (after === null ||
            (Object.keys(before) as Array<keyof T>).some(
                (key) => before[key] !== null && after[key] === null
            ))
    return (
        (
            [
                "scheduledAt",
                "teams",
                "map",
                "hosting",
                "mapVote",
                "rules",
                "progress",
                "results",
            ] as const
        ).some((field) => previous[field] !== null && next[field] === null) ||
        (previous.teams !== null &&
            next.teams !== null &&
            (next.teams.length < previous.teams.length ||
                previous.teams.some((team) => {
                    const updated = next.teams!.find(
                        (item) => item.code === team.code
                    )
                    return updated ? lostFields(team, updated) : false
                }))) ||
        lostFields(previous.map, next.map) ||
        lostFields(previous.hosting, next.hosting) ||
        lostFields(previous.mapVote, next.mapVote) ||
        lostFields(previous.rules, next.rules)
    )
}
