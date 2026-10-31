import {
    teamGameSchema,
    teamNameSchema,
    teamShortCodeSchema,
    teamDescriptionSchema,
    teamRevisionSchema,
    imageAssetIdSchema,
} from "../teams/team"
import type { PublicCompetitionFixture } from "../competitions/competition"
import { z } from "zod"

const id = z.string().min(1).max(64)
export const leagueHostSchema = z.discriminatedUnion("kind", [
    z.strictObject({
        kind: z.literal("linked"),
        sourceRef: z.string().min(1).max(256),
    }),
    z.strictObject({
        kind: z.literal("external"),
        label: z.string().trim().min(1).max(120),
    }),
])
export function teamLinkError(input: {
    accountOwner: boolean
    workspaceAdmin: boolean
    active: boolean
    linkedGuildId: string | null
    guildId: string
    occupied: boolean
}) {
    if (!input.accountOwner || !input.workspaceAdmin) return "forbidden"
    if (!input.active) return "not_found"
    if (input.linkedGuildId && input.linkedGuildId !== input.guildId)
        return "team_already_linked"
    if (input.occupied) return "guild_already_linked"
    return null
}
export const leagueCommandSchema = z.discriminatedUnion("action", [
    z.strictObject({
        action: z.literal("createTeam"),
        name: teamNameSchema,
        shortCode: teamShortCodeSchema.nullable(),
        gameId: teamGameSchema,
        description: teamDescriptionSchema.nullable(),
        idempotencyKey: z.string().uuid(),
        guildId: z
            .string()
            .regex(/^\d{17,20}$/)
            .optional(),
    }),
    z.strictObject({
        action: z.literal("createAndEnroll"),
        competitionId: id,
        name: teamNameSchema,
        shortCode: teamShortCodeSchema.nullable(),
        description: teamDescriptionSchema.nullable(),
        idempotencyKey: z.string().uuid(),
    }),
    z.strictObject({
        action: z.literal("updateTeam"),
        teamId: id,
        expectedRevision: teamRevisionSchema,
        name: teamNameSchema,
        shortCode: teamShortCodeSchema.nullable(),
        description: teamDescriptionSchema.nullable(),
        logoAssetId: imageAssetIdSchema.nullable(),
    }),
    z.strictObject({
        action: z.literal("linkTeam"),
        teamId: id,
        guildId: z.string().regex(/^\d{17,20}$/),
    }),
    z.strictObject({
        action: z.literal("joinTeam"),
        token: z.string().regex(/^[a-f0-9]{32}$/),
    }),
    z.strictObject({
        action: z.literal("enroll"),
        competitionId: id,
        teamId: id,
    }),
    z.strictObject({
        action: z.literal("withdraw"),
        competitionId: id,
        teamId: id,
    }),
    z.strictObject({
        action: z.literal("setHost"),
        fixtureId: id,
        host: leagueHostSchema,
    }),
    z.strictObject({
        action: z.literal("reportScore"),
        fixtureId: id,
        teamId: id,
        participantTeamIds: z
            .array(id)
            .min(2)
            .max(3)
            .refine((ids) => new Set(ids).size === ids.length),
        scores: z.array(z.number().int().min(0).max(999)).min(2).max(3),
    }),
    z.strictObject({
        action: z.literal("approveScore"),
        fixtureId: id,
        reportId: id,
    }),
])
export type LeagueCommand = z.infer<typeof leagueCommandSchema>
export type FixtureHost =
    | { kind: "external"; label: string }
    | { kind: "linked"; sourceRef: string; guildId: string; label: string }
export type PublicFixtureHost = { kind: "external" | "linked"; label: string }
export type LeaguePortalTeam = {
    id: string
    name: string
    shortCode: string | null
    gameId: string
    owner: boolean
    members: number
    inviteToken: string | null
    clanLinked: boolean
    linkedGuildId: string | null
    accountOwner: boolean
    description: string | null
    logoAssetId: string | null
    logoUrl: string | null
    revision: number
}
export type LeaguePortalView = {
    teams: LeaguePortalTeam[]
    workspaces: Array<{
        guildId: string
        workspaceId: string
        name: string
        teamId: string | null
    }>
    registrations: Array<{
        competitionId: string
        teamId: string
        status: "pending" | "approved" | "rejected"
        withdrawn: boolean
        competitionName: string | null
        competitionSlug: string | null
        season: string | null
    }>
    servers: Array<{
        sourceRef: string
        guildId: string
        gameId: string
        label: string
    }>
    fixtures: Array<
        PublicCompetitionFixture & {
            competitionId: string
            competitionName: string
            participants: Array<{ id: string; name: string }>
            host: PublicFixtureHost | null
            reports: Array<{ id: string; teamId: string; scores: number[] }>
        }
    >
    organiser: boolean
}

export function fixtureParticipantIds(fixture: {
    participantTeamIds?: readonly string[]
    sideATeamId?: string
    sideBTeamId?: string
}): string[] {
    return fixture.participantTeamIds?.length
        ? [...fixture.participantTeamIds]
        : [fixture.sideATeamId, fixture.sideBTeamId].filter(
              (value): value is string => Boolean(value)
          )
}
/** External servers never gain statistics by attaching a local event later. */
export function permitsFixtureStatistics(
    host: { kind: string } | null | undefined
) {
    return host?.kind !== "external"
}
export function hostChangeError(input: {
    published: boolean
    participant: boolean
    organiser: boolean
    final: boolean
    hasLinkedEvents: boolean
    hasScoreReports?: boolean
}) {
    if (!input.participant && !input.organiser) return "forbidden"
    if (
        !input.published ||
        input.final ||
        input.hasLinkedEvents ||
        input.hasScoreReports
    )
        return "hosting_locked"
    return null
}
/** Require a recent successful observation, not merely saved credentials. */
export function usableLeagueServer(input: {
    enabled: boolean
    gameMatches: boolean
    error: string | null
    observedAt: string | null
    state: string | null
    capabilities: readonly string[]
    now: number
}) {
    const observed = input.observedAt ? Date.parse(input.observedAt) : NaN
    return (
        input.enabled &&
        input.gameMatches &&
        input.error === null &&
        input.state === "online" &&
        input.capabilities.includes("match_history") &&
        Number.isFinite(observed) &&
        observed <= input.now &&
        input.now - observed <= 15 * 60_000
    )
}
export function agreedManualScores(
    participants: readonly string[],
    reports: readonly { teamId: string; scores: readonly number[] }[]
): number[] | null {
    if (
        participants.length < 2 ||
        new Set(participants).size !== participants.length
    )
        return null
    const ordered = participants.map((teamId) =>
        reports.find((report) => report.teamId === teamId)
    )
    const first = ordered[0]
    if (!first || first.scores.length !== participants.length) return null
    if (
        !first.scores.every(
            (score) => Number.isInteger(score) && score >= 0 && score <= 999
        )
    )
        return null
    return ordered.every(
        (report) =>
            report &&
            report.scores.length === first.scores.length &&
            report.scores.every((score, index) => score === first.scores[index])
    )
        ? [...first.scores]
        : null
}
