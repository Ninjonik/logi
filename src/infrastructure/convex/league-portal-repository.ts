import {
    fixtureParticipantIds,
    usableLeagueServer,
    type FixtureHost,
    type LeagueCommand,
    type LeaguePortalView,
} from "../../domain/leagues/portal"
import {
    enrollmentPolicy,
    hasCompetitionHistory,
    type EnrollmentStatus,
} from "../../domain/competitions/enrollment"
import {
    COMPETITION_REGISTRATION_LIMIT,
    isCompetitionPublished,
} from "../../domain/competitions/competition"
import {
    ConvexTeamDirectoryRepository,
    ConvexTeamLogoPort,
} from "./team-directory-repositories"
import {
    authorizeDashboardAdmin,
    type DashboardActor,
} from "../../../convex/dashboardActor"
import {
    getGuildByDiscordId,
    getGuildDiscordId,
} from "../../../convex/identity"
import type { LeaguePortalPorts } from "../../application/leagues/portal.use-case"
import { linkedPlayerCount } from "../../../convex/competitionEnrollmentStore"
import type { MutationCtx, QueryCtx } from "../../../convex/_generated/server"
import { createTeam } from "../../application/teams/team-directory.use-case"
import type { Doc } from "../../../convex/_generated/dataModel"

type Db = Pick<QueryCtx, "db">
export type LeagueActor = {
    actor: DashboardActor
    secret: string
    user: Doc<"users">
    guildIds: string[]
}
/** Recheck each managed workspace in Convex, never rely on browser-provided ownership. */
export async function leagueOwnership(ctx: Db, access: LeagueActor) {
    const profiles = await ctx.db
        .query("leagueTeamProfiles")
        .withIndex("ownerUserId", (q) => q.eq("ownerUserId", access.user._id))
        .take(20)
    const own = new Set(profiles.map((row) => String(row.teamId)))
    const guilds: Doc<"guilds">[] = []
    for (const guildId of [...new Set(access.guildIds)].slice(0, 100)) {
        try {
            const { server } = await authorizeDashboardAdmin(ctx, {
                ...access,
                guildId,
            })
            guilds.push(server)
            const teams = await ctx.db
                .query("teamDirectory")
                .withIndex("linkedGuildId", (q) =>
                    q.eq("linkedGuildId", guildId)
                )
                .take(100)
            for (const team of teams) own.add(String(team._id))
        } catch (error) {
            if (
                !(error instanceof Error) ||
                !error.message.includes("Forbidden")
            )
                throw error
        }
    }
    return { profiles, own, guilds }
}
export async function leagueServers(
    ctx: Db,
    guilds: Doc<"guilds">[],
    now: number
) {
    const result: LeaguePortalView["servers"] = []
    for (const guild of guilds) {
        const sources = await ctx.db
            .query("gameDataConnections")
            .withIndex("guildId", (q) =>
                q.eq("guildId", getGuildDiscordId(guild))
            )
            .take(100)
        for (const source of sources) {
            if (
                !usableLeagueServer({
                    enabled: source.enabled,
                    gameMatches: true,
                    error: source.errorCategory,
                    observedAt: source.observation?.observedAt ?? null,
                    state: source.observation?.state ?? null,
                    capabilities: source.observation?.capabilities ?? [],
                    now,
                })
            )
                continue
            result.push({
                sourceRef: source.sourceRef,
                guildId: getGuildDiscordId(guild),
                gameId: source.gameId,
                label: `${guild.name ?? "Logi"} · ${source.observation?.displayName ?? source.providerServerId}`,
            })
        }
    }
    return result
}
export class ConvexLeaguePortalRepository implements LeaguePortalPorts {
    constructor(
        private readonly ctx: MutationCtx,
        private readonly access: LeagueActor,
        private readonly ownership: Awaited<ReturnType<typeof leagueOwnership>>,
        private readonly now: string
    ) {}
    async createTeam(input: Extract<LeagueCommand, { action: "createTeam" }>) {
        const repository = new ConvexTeamDirectoryRepository(this.ctx)
        const idempotencyKey = `league_${this.access.actor.subject}_${input.idempotencyKey}`
        if (
            !(await repository.findCreate(idempotencyKey)) &&
            this.ownership.profiles.length >= 5
        )
            return { error: "team_limit" }
        const result = await createTeam(
            {
                repository,
                logos: new ConvexTeamLogoPort(this.ctx),
                now: () => this.now,
            },
            { actor: this.access.actor.subject },
            {
                gameId: input.gameId,
                name: input.name,
                shortCode: input.shortCode,
                description: input.description,
                logoAssetId: null,
                links: [],
                linkedGuildId: null,
                idempotencyKey,
            }
        )
        if ("error" in result) return result
        const teamId = this.ctx.db.normalizeId("teamDirectory", result.teamId)
        if (!teamId) throw new Error("Created team is unavailable")
        const existing = await this.ctx.db
            .query("leagueTeamProfiles")
            .withIndex("teamId", (q) => q.eq("teamId", teamId))
            .unique()
        if (existing && existing.ownerUserId !== this.access.user._id)
            return { error: "forbidden" }
        if (!existing) {
            await this.ctx.db.insert("leagueTeamProfiles", {
                teamId,
                ownerUserId: this.access.user._id,
                inviteToken: crypto.randomUUID().replace(/-/g, ""),
                createdAt: this.now,
            })
            await this.ctx.db.insert("leagueTeamMembers", {
                teamId,
                userId: this.access.user._id,
                joinedAt: this.now,
            })
        }
        return { ok: true as const, teamId: String(teamId) }
    }
    async joinTeam(token: string) {
        const profile = await this.ctx.db
            .query("leagueTeamProfiles")
            .withIndex("inviteToken", (q) => q.eq("inviteToken", token))
            .unique()
        const team = profile ? await this.ctx.db.get(profile.teamId) : null
        if (!profile || !team || team.archivedAt || team.mergedIntoTeamId)
            return { error: "not_found" }
        const current = await this.ctx.db
            .query("leagueTeamMembers")
            .withIndex("teamId_userId", (q) =>
                q
                    .eq("teamId", profile.teamId)
                    .eq("userId", this.access.user._id)
            )
            .unique()
        if (!current) {
            const members = await this.ctx.db
                .query("leagueTeamMembers")
                .withIndex("teamId", (q) => q.eq("teamId", profile.teamId))
                .take(1000)
            if (members.length >= 1000) return { error: "member_limit" }
            await this.ctx.db.insert("leagueTeamMembers", {
                teamId: profile.teamId,
                userId: this.access.user._id,
                joinedAt: this.now,
            })
        }
        return { ok: true as const, teamId: String(profile.teamId) }
    }
    async enrollmentFacts(teamId: string, competitionId: string) {
        const tid = this.ctx.db.normalizeId("teamDirectory", teamId),
            cid = this.ctx.db.normalizeId("competitions", competitionId)
        const team = tid ? await this.ctx.db.get(tid) : null,
            competition = cid ? await this.ctx.db.get(cid) : null
        if (!team || !competition) return null
        const registration = await this.ctx.db
            .query("competitionTeams")
            .withIndex("competitionId_teamId", (q) =>
                q.eq("competitionId", competition._id).eq("teamId", team._id)
            )
            .first()
        const guild = team.linkedGuildId
            ? await getGuildByDiscordId(this.ctx, team.linkedGuildId)
            : null
        const members = guild
            ? await linkedPlayerCount(this.ctx, guild)
            : (
                  await this.ctx.db
                      .query("leagueTeamMembers")
                      .withIndex("teamId", (q) => q.eq("teamId", team._id))
                      .take(1000)
              ).length
        return {
            owned: this.ownership.own.has(teamId),
            active: !team.archivedAt && !team.mergedIntoTeamId,
            gameMatches:
                team.gameId === (competition.gameId ?? "hell_let_loose"),
            published: isCompetitionPublished(competition),
            ...enrollmentPolicy(competition),
            members,
            existing: registration
                ? {
                      status: registration.status ?? "approved",
                      withdrawn: registration.withdrawn,
                  }
                : null,
            slug: competition.slug,
        }
    }
    async saveRegistration(
        teamId: string,
        competitionId: string,
        status: EnrollmentStatus,
        withdrawn: boolean
    ) {
        const tid = this.ctx.db.normalizeId("teamDirectory", teamId),
            cid = this.ctx.db.normalizeId("competitions", competitionId)
        if (!tid || !cid) throw new Error("Missing registration")
        const existing = await this.ctx.db
            .query("competitionTeams")
            .withIndex("competitionId_teamId", (q) =>
                q.eq("competitionId", cid).eq("teamId", tid)
            )
            .first()
        if (existing)
            await this.ctx.db.patch(
                existing._id,
                withdrawn
                    ? { withdrawn: true, updatedAt: this.now }
                    : {
                          status,
                          withdrawn: false,
                          previouslyApproved: hasCompetitionHistory(existing),
                          requestedBy: this.access.actor.subject,
                          decidedBy: undefined,
                          decidedAt: undefined,
                          updatedAt: this.now,
                      }
            )
        else {
            const rows = await this.ctx.db
                .query("competitionTeams")
                .withIndex("competitionId", (q) => q.eq("competitionId", cid))
                .take(COMPETITION_REGISTRATION_LIMIT)
            if (rows.length >= COMPETITION_REGISTRATION_LIMIT)
                throw new Error("Registration capacity reached")
            await this.ctx.db.insert("competitionTeams", {
                competitionId: cid,
                teamId: tid,
                status,
                withdrawn,
                requestedBy: this.access.actor.subject,
                createdAt: this.now,
                updatedAt: this.now,
            })
        }
        await this.ctx.db.patch(cid, { updatedAt: this.now })
    }
    async fixture(id: string) {
        const fid = this.ctx.db.normalizeId("competitionFixtures", id),
            fixture = fid ? await this.ctx.db.get(fid) : null
        const competition = fixture
            ? await this.ctx.db.get(fixture.competitionId)
            : null
        if (!fixture || !competition) return null
        const participants = fixtureParticipantIds(fixture)
        return {
            id: String(fixture._id),
            competitionId: String(competition._id),
            slug: competition.slug,
            gameId: competition.gameId ?? "hell_let_loose",
            published: isCompetitionPublished(competition),
            participants,
            ownedParticipants: participants.filter((id) =>
                this.ownership.own.has(id)
            ),
            organiser: this.access.actor.superadmin,
            final: fixture.status !== "scheduled",
            hasLinkedEvents: Boolean(
                fixture.eventId || fixture.eventIds?.length
            ),
            hasScoreReports: Boolean(
                await this.ctx.db
                    .query("leagueScoreReports")
                    .withIndex("fixtureId", (q) =>
                        q.eq("fixtureId", fixture._id)
                    )
                    .first()
            ),
            host: fixture.hosting ?? null,
        }
    }
    async linkedHost(sourceRef: string, gameId: string) {
        const source = (
            await leagueServers(
                this.ctx,
                this.ownership.guilds,
                Date.parse(this.now)
            )
        ).find(
            (source) =>
                source.sourceRef === sourceRef && source.gameId === gameId
        )
        return source
            ? {
                  kind: "linked" as const,
                  sourceRef: source.sourceRef,
                  guildId: source.guildId,
                  label: source.label,
              }
            : null
    }
    async saveHost(id: string, hosting: FixtureHost) {
        const fid = this.ctx.db.normalizeId("competitionFixtures", id)
        if (!fid) throw new Error("Missing fixture")
        await this.ctx.db.patch(fid, {
            hosting,
            hostingUpdatedBy: this.access.actor.subject,
            updatedAt: this.now,
        })
    }
    async reportScore(
        fixtureId: string,
        teamId: string,
        scores: number[],
        participantTeamIds: string[]
    ) {
        const fid = this.ctx.db.normalizeId("competitionFixtures", fixtureId),
            tid = this.ctx.db.normalizeId("teamDirectory", teamId)
        if (!fid || !tid) throw new Error("Missing fixture")
        const ordered = participantTeamIds.flatMap((id) => {
            const value = this.ctx.db.normalizeId("teamDirectory", id)
            return value ? [value] : []
        })
        if (ordered.length !== participantTeamIds.length)
            throw new Error("Invalid fixture participants")
        const current = await this.ctx.db
            .query("leagueScoreReports")
            .withIndex("fixtureId_teamId", (q) =>
                q.eq("fixtureId", fid).eq("teamId", tid)
            )
            .unique()
        if (current)
            await this.ctx.db.patch(current._id, {
                scores,
                participantTeamIds: ordered,
                userId: this.access.user._id,
                updatedAt: this.now,
            })
        else
            await this.ctx.db.insert("leagueScoreReports", {
                fixtureId: fid,
                teamId: tid,
                scores,
                participantTeamIds: ordered,
                userId: this.access.user._id,
                createdAt: this.now,
                updatedAt: this.now,
            })
    }
    async reports(id: string) {
        const fid = this.ctx.db.normalizeId("competitionFixtures", id)
        const fixture = fid ? await this.ctx.db.get(fid) : null
        if (!fid || !fixture) return []
        const participants = fixtureParticipantIds(fixture)
        return (
            await this.ctx.db
                .query("leagueScoreReports")
                .withIndex("fixtureId", (q) => q.eq("fixtureId", fid))
                .take(10)
        )
            .filter(
                (row) =>
                    row.participantTeamIds?.length === participants.length &&
                    row.participantTeamIds.every(
                        (id, index) => id === participants[index]
                    )
            )
            .map((row) => ({
                id: String(row._id),
                teamId: String(row.teamId),
                scores: row.scores,
            }))
    }
    async finalizeScore(id: string, scores: number[], organiser: boolean) {
        const fid = this.ctx.db.normalizeId("competitionFixtures", id)
        if (!fid) throw new Error("Missing fixture")
        await this.ctx.db.patch(fid, {
            scoreA: scores[0],
            scoreB: scores[1],
            participantScores: scores,
            status: "final",
            resultConflict: false,
            ...(organiser
                ? { manualResultApprovedBy: this.access.actor.subject }
                : {}),
            updatedAt: this.now,
        })
    }
}

/** Private account read; tokens and draft score reports never enter public projections. */
export async function leaguePortalView(
    ctx: Db,
    access: LeagueActor,
    competitionId: string | null
): Promise<LeaguePortalView> {
    const ownership = await leagueOwnership(ctx, access)
    const memberships = await ctx.db
        .query("leagueTeamMembers")
        .withIndex("userId", (q) => q.eq("userId", access.user._id))
        .take(100)
    const ids = new Set([
        ...ownership.own,
        ...memberships.map((row) => String(row.teamId)),
    ])
    const teams: LeaguePortalView["teams"] = []
    for (const id of ids) {
        const tid = ctx.db.normalizeId("teamDirectory", id),
            team = tid ? await ctx.db.get(tid) : null
        if (!team || team.archivedAt || team.mergedIntoTeamId) continue
        const profile = ownership.profiles.find(
            (profile) => profile.teamId === team._id
        )
        const guild = team.linkedGuildId
            ? await getGuildByDiscordId(ctx, team.linkedGuildId)
            : null
        const members = guild
            ? await linkedPlayerCount(ctx, guild)
            : (
                  await ctx.db
                      .query("leagueTeamMembers")
                      .withIndex("teamId", (q) => q.eq("teamId", team._id))
                      .take(1000)
              ).length
        teams.push({
            id: String(team._id),
            name: team.name,
            shortCode: team.shortCode,
            gameId: team.gameId,
            owner: ownership.own.has(id),
            members,
            inviteToken: profile?.inviteToken ?? null,
            clanLinked: Boolean(team.linkedGuildId),
        })
    }
    const registrations: LeaguePortalView["registrations"] = []
    for (const team of teams) {
        const tid = ctx.db.normalizeId("teamDirectory", team.id)
        if (!tid) continue
        const rows = await ctx.db
            .query("competitionTeams")
            .withIndex("teamId", (q) => q.eq("teamId", tid))
            .take(500)
        for (const row of rows)
            registrations.push({
                competitionId: String(row.competitionId),
                teamId: team.id,
                status: row.status ?? "approved",
                withdrawn: row.withdrawn,
            })
    }
    const fixtures: LeaguePortalView["fixtures"] = []
    const cid = competitionId
        ? ctx.db.normalizeId("competitions", competitionId)
        : null
    const competition = cid ? await ctx.db.get(cid) : null
    if (competition && isCompetitionPublished(competition)) {
        const rows = await ctx.db
            .query("competitionFixtures")
            .withIndex("competitionId", (q) =>
                q.eq("competitionId", competition._id)
            )
            .take(2000)
        for (const fixture of rows) {
            const participantIds = fixtureParticipantIds(fixture)
            if (
                !access.actor.superadmin &&
                !participantIds.some((id) => ids.has(id))
            )
                continue
            const participants: Array<{ id: string; name: string }> = []
            for (const id of participantIds) {
                const tid = ctx.db.normalizeId("teamDirectory", id)
                const team = tid ? await ctx.db.get(tid) : null
                participants.push({ id, name: team?.name ?? "—" })
            }
            const reports = await ctx.db
                .query("leagueScoreReports")
                .withIndex("fixtureId", (q) => q.eq("fixtureId", fixture._id))
                .take(10)
            fixtures.push({
                id: String(fixture._id),
                competitionId: String(competition._id),
                competitionName: competition.name,
                participants,
                participantTeamIds: participantIds,
                teamAId: participantIds[0] ?? "",
                teamBId: participantIds[1] ?? "",
                phase: fixture.phase,
                status: fixture.status,
                scoreA: fixture.scoreA,
                scoreB: fixture.scoreB,
                participantScores: fixture.participantScores,
                scheduledAt: fixture.scheduledAt,
                host: fixture.hosting
                    ? {
                          kind: fixture.hosting.kind,
                          label: fixture.hosting.label,
                      }
                    : null,
                reports: reports
                    .filter(
                        (row) =>
                            row.participantTeamIds?.length ===
                                participantIds.length &&
                            row.participantTeamIds.every(
                                (id, index) => id === participantIds[index]
                            )
                    )
                    .map((row) => ({
                        id: String(row._id),
                        teamId: String(row.teamId),
                        scores: row.scores,
                    })),
            })
        }
    }
    return {
        teams,
        registrations,
        servers: await leagueServers(ctx, ownership.guilds, Date.now()),
        fixtures,
        organiser: access.actor.superadmin,
    }
}
