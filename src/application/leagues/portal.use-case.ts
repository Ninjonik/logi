import {
    agreedManualScores,
    teamLinkError,
    hostChangeError,
    leagueCommandSchema,
    type FixtureHost,
    type LeagueCommand,
} from "../../domain/leagues/portal"
import {
    checkClanEnrollment,
    type EnrollmentStatus,
    type RegistrationMode,
} from "../../domain/competitions/enrollment"
import type { TeamGame } from "../../domain/teams/team"

type Create = Extract<LeagueCommand, { action: "createTeam" }>
export type LeagueFailure = { error: string }
export type LeagueResult =
    | {
          ok: true
          teamId?: string
          slug?: string
          registrationError?: string
          competitionSlugs?: string[]
          guildId?: string
      }
    | LeagueFailure
export type EnrollmentFacts = {
    owned: boolean
    active: boolean
    gameMatches: boolean
    published: boolean
    registrationMode: RegistrationMode
    minimumLinkedPlayers: number | null
    members: number
    existing: { status: EnrollmentStatus; withdrawn: boolean } | null
    slug: string
}
export type FixtureFacts = {
    id: string
    competitionId: string
    slug: string
    gameId: string
    published: boolean
    participants: string[]
    ownedParticipants: string[]
    organiser: boolean
    final: boolean
    hasLinkedEvents: boolean
    hasScoreReports?: boolean
    host: FixtureHost | null
}
export interface LeaguePortalPorts {
    createTeam(input: Create): Promise<LeagueResult>
    competitionForSignup(id: string): Promise<{
        gameId: TeamGame
        published: boolean
        registrationMode: RegistrationMode
        slug: string
    } | null>
    workspaceForTeam(guildId: string): Promise<{ admin: boolean }>
    updateTeam(
        input: Extract<LeagueCommand, { action: "updateTeam" }>
    ): Promise<LeagueResult>
    linkFacts(
        teamId: string,
        guildId: string
    ): Promise<Parameters<typeof teamLinkError>[0] | null>
    saveTeamLink(teamId: string, guildId: string): Promise<LeagueResult>
    joinTeam(token: string): Promise<LeagueResult>
    enrollmentFacts(
        teamId: string,
        competitionId: string
    ): Promise<EnrollmentFacts | null>
    saveRegistration(
        teamId: string,
        competitionId: string,
        status: EnrollmentStatus,
        withdrawn: boolean
    ): Promise<void>
    fixture(id: string): Promise<FixtureFacts | null>
    linkedHost(
        sourceRef: string,
        gameId: string
    ): Promise<Extract<FixtureHost, { kind: "linked" }> | null>
    saveHost(fixtureId: string, host: FixtureHost): Promise<void>
    reportScore(
        fixtureId: string,
        teamId: string,
        scores: number[],
        participantTeamIds: string[]
    ): Promise<void>
    reports(
        fixtureId: string
    ): Promise<Array<{ id: string; teamId: string; scores: number[] }>>
    finalizeScore(
        fixtureId: string,
        scores: number[],
        organiser: boolean
    ): Promise<void>
}
/** Session authentication and persistence are adapters; permissions and ordered decisions live here. */
export async function executeLeagueCommand(
    ports: LeaguePortalPorts,
    raw: unknown
): Promise<LeagueResult> {
    const parsed = leagueCommandSchema.safeParse(raw)
    if (!parsed.success) return { error: "invalid_input" }
    const input = parsed.data
    if (input.action === "createTeam") {
        if (input.guildId) {
            const workspace = await ports.workspaceForTeam(input.guildId)
            if (!workspace.admin) return { error: "forbidden" }
        }
        return ports.createTeam(input)
    }
    if (input.action === "updateTeam") return ports.updateTeam(input)
    if (input.action === "createAndEnroll") {
        const competition = await ports.competitionForSignup(
            input.competitionId
        )
        if (!competition || !competition.published)
            return { error: "not_found" }
        if (competition.registrationMode === "closed")
            return { error: "registration_closed" }
        const { competitionId, ...details } = input
        const created = await ports.createTeam({
            ...details,
            action: "createTeam",
            gameId: competition.gameId,
        })
        if ("error" in created || !created.teamId) return created
        const enrolled = await executeLeagueCommand(ports, {
            action: "enroll",
            competitionId,
            teamId: created.teamId,
        })
        return "error" in enrolled
            ? {
                  ok: true,
                  teamId: created.teamId,
                  slug: competition.slug,
                  registrationError: enrolled.error,
              }
            : { ...enrolled, teamId: created.teamId }
    }
    if (input.action === "linkTeam") {
        const facts = await ports.linkFacts(input.teamId, input.guildId)
        if (!facts) return { error: "forbidden" }
        const error = teamLinkError(facts)
        if (error) return { error }
        if (facts.linkedGuildId === input.guildId) return { ok: true }
        return ports.saveTeamLink(input.teamId, input.guildId)
    }
    if (input.action === "joinTeam") return ports.joinTeam(input.token)
    if (input.action === "enroll" || input.action === "withdraw") {
        const facts = await ports.enrollmentFacts(
            input.teamId,
            input.competitionId
        )
        if (!facts || !facts.owned) return { error: "forbidden" }
        if (input.action === "withdraw") {
            if (!facts.existing) return { error: "not_found" }
            await ports.saveRegistration(
                input.teamId,
                input.competitionId,
                facts.existing.status,
                true
            )
        } else {
            if (
                facts.existing &&
                !facts.existing.withdrawn &&
                facts.existing.status !== "rejected"
            )
                return { ok: true, slug: facts.slug }
            const error = checkClanEnrollment({
                published: facts.published,
                registrationMode: facts.registrationMode,
                minimumLinkedPlayers: facts.minimumLinkedPlayers,
                linkedPlayers: facts.members,
                teamLinked: true,
                teamActive: facts.active,
                gameMatches: facts.gameMatches,
            })
            if (error) return { error }
            await ports.saveRegistration(
                input.teamId,
                input.competitionId,
                facts.registrationMode === "approval" ? "pending" : "approved",
                false
            )
        }
        return { ok: true, slug: facts.slug }
    }
    const fixture = await ports.fixture(input.fixtureId)
    if (!fixture || !fixture.published) return { error: "not_found" }
    if (input.action === "setHost") {
        const blocked = hostChangeError({
            published: fixture.published,
            participant: fixture.ownedParticipants.length > 0,
            organiser: fixture.organiser,
            final: fixture.final,
            hasLinkedEvents: fixture.hasLinkedEvents,
            hasScoreReports: fixture.hasScoreReports,
        })
        if (blocked) return { error: blocked }
        const host =
            input.host.kind === "external"
                ? input.host
                : await ports.linkedHost(input.host.sourceRef, fixture.gameId)
        if (!host) return { error: "server_unavailable" }
        await ports.saveHost(fixture.id, host)
        return { ok: true, slug: fixture.slug }
    }
    if (fixture.host?.kind !== "external")
        return { error: "manual_scores_external_only" }
    if (fixture.final) return { error: "result_locked" }
    if (input.action === "approveScore") {
        if (!fixture.organiser) return { error: "forbidden" }
        const report = (await ports.reports(fixture.id)).find(
            (row) => row.id === input.reportId
        )
        if (!report || report.scores.length !== fixture.participants.length)
            return { error: "invalid_scores" }
        await ports.finalizeScore(fixture.id, report.scores, true)
    } else {
        if (!fixture.ownedParticipants.includes(input.teamId))
            return { error: "forbidden" }
        if (
            input.scores.length !== fixture.participants.length ||
            input.participantTeamIds.length !== fixture.participants.length ||
            input.participantTeamIds.some(
                (id, index) => id !== fixture.participants[index]
            )
        )
            return { error: "invalid_scores" }
        await ports.reportScore(
            fixture.id,
            input.teamId,
            input.scores,
            fixture.participants
        )
        const scores = agreedManualScores(
            fixture.participants,
            await ports.reports(fixture.id)
        )
        if (scores) await ports.finalizeScore(fixture.id, scores, false)
    }
    return { ok: true, slug: fixture.slug }
}
