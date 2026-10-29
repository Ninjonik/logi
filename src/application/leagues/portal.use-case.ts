import {
    agreedManualScores,
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

type Create = Extract<LeagueCommand, { action: "createTeam" }>
export type LeagueFailure = { error: string }
export type LeagueResult =
    { ok: true; teamId?: string; slug?: string } | LeagueFailure
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
    if (input.action === "createTeam") return ports.createTeam(input)
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
