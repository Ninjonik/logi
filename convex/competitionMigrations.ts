import { ConvexTeamDirectoryRepository } from "../src/infrastructure/convex/team-directory-repositories"
import { adoptCatalogueTeam } from "../src/application/competitions/adopt-catalogue-team.use-case"
import { adoptedTeamName } from "../src/domain/competitions/competition"
import { teamGameSchema, type TeamGame } from "../src/domain/teams/team"
import { internalMutation, type MutationCtx } from "./_generated/server"
import { resolveGameScope } from "../src/domain/games/game"
import type { Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"
import { v } from "convex/values"

const BATCH = 100
/** Audit actor of catalogue teams created or linked by this migration. */
export const COMPETITION_MIGRATION_ACTOR = "system:competition-migration"

type Phase = "teams" | "fixtures"
function parseCursor(cursor: string | undefined): [Phase, string | null] {
    if (cursor === undefined) return ["teams", null]
    const match = /^(teams|fixtures):([\s\S]*)$/.exec(cursor)
    if (!match) throw new Error("Invalid migration cursor.")
    return [match[1] as Phase, match[2] || null]
}

type Counts = {
    registrationsAdopted: number
    registrationsMerged: number
    fixturesConverted: number
    teamsCreated: number
    teamsMatched: number
    teamsLinked: number
    unresolved: number
}

/**
 * Finds or creates the global team for one legacy workspace reference in one
 * game, once per batch. A real Logi workspace (one with a Discord ID) is
 * recorded as the team's linked workspace; placeholder clans are not.
 */
function teamAdopter(ctx: MutationCtx, counts: Counts) {
    const ports = {
        repository: new ConvexTeamDirectoryRepository(ctx),
        now: () => new Date().toISOString(),
    }
    const cache = new Map<string, Id<"teamDirectory"> | null>()
    return async (
        gameId: TeamGame,
        guildId: Id<"guilds">
    ): Promise<Id<"teamDirectory"> | null> => {
        const key = `${gameId}:${guildId}`
        if (cache.has(key)) return cache.get(key)!
        const guild = await ctx.db.get(guildId)
        let teamId: Id<"teamDirectory"> | null = null
        if (guild) {
            const adopted = await adoptCatalogueTeam(
                ports,
                COMPETITION_MIGRATION_ACTOR,
                {
                    gameId,
                    name: adoptedTeamName(guild.name, `Team ${guildId}`),
                    linkedGuildId: guild.discordId ?? null,
                }
            )
            if ("ok" in adopted) {
                teamId = ctx.db.normalizeId("teamDirectory", adopted.teamId)
                if (adopted.created) counts.teamsCreated++
                else counts.teamsMatched++
                if (adopted.linked) counts.teamsLinked++
            }
        }
        cache.set(key, teamId)
        return teamId
    }
}

/** Competition game as a catalogue game; Hell Let Loose: Vietnam has no catalogue. */
async function competitionGame(
    ctx: MutationCtx,
    competitionId: Id<"competitions">
): Promise<TeamGame | null> {
    const competition = await ctx.db.get(competitionId)
    if (!competition) return null
    const game = teamGameSchema.safeParse(resolveGameScope(competition.gameId))
    return game.success ? game.data : null
}

/**
 * One-time, idempotent conversion of competition records from Logi workspaces
 * (`guilds`, including placeholder "ghost" clans) to global catalogue teams.
 *
 * Phase `teams` sets `competitionTeams.teamId` for every registration that
 * only has a `guildId`: the guild becomes, or matches by normalized name, a
 * global team of the competition's game. When two legacy registrations of one
 * competition resolve to the same team, the later one is removed. Phase
 * `fixtures` fills `sideATeamId`/`sideBTeamId` from `teamAId`/`teamBId` with
 * the same mapping. Legacy guild fields stay as provenance.
 *
 * Each call handles one batch and schedules the next while work remains.
 * Re-running after completion changes nothing. Owner command:
 * `npx convex run competitionMigrations:adoptGlobalTeams`
 */
export const adoptGlobalTeams = internalMutation({
    args: { cursor: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const [phase, position] = parseCursor(args.cursor)
        const counts: Counts = {
            registrationsAdopted: 0,
            registrationsMerged: 0,
            fixturesConverted: 0,
            teamsCreated: 0,
            teamsMatched: 0,
            teamsLinked: 0,
            unresolved: 0,
        }
        const adopt = teamAdopter(ctx, counts)
        const now = new Date().toISOString()
        let next: string | null
        if (phase === "teams") {
            const page = await ctx.db
                .query("competitionTeams")
                .paginate({ cursor: position, numItems: BATCH })
            for (const row of page.page) {
                if (row.teamId || !row.guildId) continue
                const gameId = await competitionGame(ctx, row.competitionId)
                const teamId = gameId ? await adopt(gameId, row.guildId) : null
                if (!teamId) {
                    counts.unresolved++
                    continue
                }
                const existing = await ctx.db
                    .query("competitionTeams")
                    .withIndex("competitionId_teamId", (q) =>
                        q
                            .eq("competitionId", row.competitionId)
                            .eq("teamId", teamId)
                    )
                    .first()
                if (existing && existing._id !== row._id) {
                    await ctx.db.delete(row._id)
                    counts.registrationsMerged++
                } else {
                    await ctx.db.patch(row._id, { teamId, updatedAt: now })
                    counts.registrationsAdopted++
                }
            }
            next = page.isDone ? "fixtures:" : `teams:${page.continueCursor}`
        } else {
            const page = await ctx.db
                .query("competitionFixtures")
                .paginate({ cursor: position, numItems: BATCH })
            for (const row of page.page) {
                if (row.sideATeamId && row.sideBTeamId) continue
                const gameId = await competitionGame(ctx, row.competitionId)
                const resolve = async (
                    current: Id<"teamDirectory"> | undefined,
                    guildId: Id<"guilds"> | undefined
                ) =>
                    current ??
                    (gameId && guildId ? await adopt(gameId, guildId) : null)
                const sideATeamId = await resolve(row.sideATeamId, row.teamAId)
                const sideBTeamId = await resolve(row.sideBTeamId, row.teamBId)
                if (!sideATeamId || !sideBTeamId) {
                    counts.unresolved++
                    continue
                }
                await ctx.db.patch(row._id, {
                    sideATeamId,
                    sideBTeamId,
                    updatedAt: now,
                })
                counts.fixturesConverted++
            }
            next = page.isDone ? null : `fixtures:${page.continueCursor}`
        }
        if (next !== null)
            await ctx.scheduler.runAfter(
                0,
                internal.competitionMigrations.adoptGlobalTeams,
                { cursor: next }
            )
        return { phase, ...counts, done: next === null, nextCursor: next }
    },
})
