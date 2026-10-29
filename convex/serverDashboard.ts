import { query } from "./_generated/server"
import { v } from "convex/values"

import {
    getGuildDiscordId,
    getUserByIdentifier,
    getUserDiscordId,
    getUserStableId,
} from "./identity"
import { hasRecentMatchResult } from "../src/domain/match-results/recent-result"
import { resolveGameScope, matchesGameScope } from "../src/domain/games/game"
import { resolveTeamResult } from "../src/domain/match-results/team-result"
import { internalAuthSecret } from "./discord_shared"

export const getRecentMatchSummaryInternal = query({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        gameScope: v.optional(v.union(v.literal("all"), v.string())),
    },
    handler: async (ctx, args) => {
        if (args.secret !== internalAuthSecret())
            throw new Error("Unauthorized.")

        const server = await ctx.db.get(args.serverId)
        if (!server) return null

        const guildId = getGuildDiscordId(server)
        const recentEvents = (
            await ctx.db
                .query("events")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect()
        )
            .filter(
                (event) =>
                    hasRecentMatchResult(event) &&
                    matchesGameScope(event.gameId, args.gameScope)
            )
            .sort(
                (left, right) =>
                    new Date(
                        right.eventResult?.endedAt ?? right.gameEnd
                    ).getTime() -
                    new Date(
                        left.eventResult?.endedAt ?? left.gameEnd
                    ).getTime()
            )
            .slice(0, 10)
        const eventsById = new Map(
            recentEvents.map((event) => [String(event._id), event])
        )
        const linkedTeams = await ctx.db
            .query("teamDirectory")
            .withIndex("linkedGuildId", (q) => q.eq("linkedGuildId", guildId))
            .take(20)
        const recentMatches = recentEvents.map((event) => {
            const own = linkedTeams.find(
                (team) =>
                    team.gameId === resolveGameScope(event.gameId) &&
                    !team.archivedAt &&
                    !team.mergedIntoTeamId
            )
            const resolved = event.reviewedResult
                ? resolveTeamResult({
                      participants: event.reviewedResult.participants,
                      teams: event.matchTeams,
                      ownTeam: own
                          ? {
                                id: String(own._id),
                                name: own.name,
                                shortCode: own.shortCode,
                            }
                          : null,
                      clanName: server.name,
                      clanSide: event.side,
                      imported: event.eventResult,
                  })
                : null
            const reviewedOutcome =
                resolved?.outcome === "win"
                    ? "victory"
                    : resolved?.outcome === "loss"
                      ? "defeat"
                      : resolved?.outcome === "draw"
                        ? "draw"
                        : null
            const reviewed = event.reviewedResult
            const scores = reviewed
                ? reviewed.participants.map((participant) => participant.score)
                : event.eventResult
                  ? [
                        event.eventResult.score.sideA,
                        event.eventResult.score.sideB,
                    ]
                  : []
            return {
                id: String(event._id),
                name: event.name,
                endedAt:
                    event.eventResult?.endedAt ??
                    reviewed?.reviewedAt ??
                    event.gameEnd,
                outcome: reviewed
                    ? reviewedOutcome
                    : (event.eventResult?.outcome ?? null),
                scores,
            }
        })

        const wins = recentMatches.filter(
            (match) => match.outcome === "victory"
        ).length
        const losses = recentMatches.filter(
            (match) => match.outcome === "defeat"
        ).length
        const decided = wins + losses
        const [statDocs, rosters, matchStats, assignments] = await Promise.all([
            ctx.db.query("playerStats").collect(),
            Promise.all(
                recentMatches.map((match) =>
                    ctx.db
                        .query("rosters")
                        .withIndex("eventId", (q) =>
                            q.eq("eventId", match.id as never)
                        )
                        .unique()
                )
            ),
            Promise.all(
                recentMatches.map((match) =>
                    ctx.db
                        .query("matchStats")
                        .withIndex("eventId", (q) =>
                            q.eq("eventId", match.id as never)
                        )
                        .unique()
                )
            ),
            ctx.db
                .query("userAssignments")
                .withIndex("serverId", (q) => q.eq("serverId", guildId))
                .collect(),
        ])
        const userIdByPlatformPlayerId = new Map(
            statDocs
                .filter((doc) => doc.userId)
                .map((doc) => [doc.id, doc.userId!])
        )
        const topPlayerTotals = new Map<
            string,
            { name: string; matches: number; kills: number; deaths: number }
        >()
        for (const match of matchStats) {
            for (const player of match?.raw.player_stats ?? []) {
                const playerId =
                    userIdByPlatformPlayerId.get(player.player_id) ??
                    `platform:${player.player_id}`
                const total = topPlayerTotals.get(playerId) ?? {
                    name: player.player,
                    matches: 0,
                    kills: 0,
                    deaths: 0,
                }
                total.matches += 1
                total.kills += player.kills
                total.deaths += player.deaths
                topPlayerTotals.set(playerId, total)
            }
        }
        const rosteredUserIds = new Set(
            assignments.map((assignment) => assignment.userId)
        )
        for (const match of recentMatches) {
            const event = eventsById.get(match.id)
            if (!event || event.gameId !== "wardogs") continue
            for (const doc of statDocs) {
                if (!doc.userId || !rosteredUserIds.has(doc.userId)) continue
                const player = doc.matches[event._id]
                if (!player) continue
                const total = topPlayerTotals.get(doc.userId) ?? {
                    name: doc.latestName ?? "Player",
                    matches: 0,
                    kills: 0,
                    deaths: 0,
                }
                total.matches += 1
                total.kills += player.kills
                total.deaths += player.deaths
                topPlayerTotals.set(doc.userId, total)
            }
        }
        const topPlayers = await Promise.all(
            [...topPlayerTotals.entries()]
                .sort(
                    ([, left], [, right]) =>
                        right.kills - left.kills || right.matches - left.matches
                )
                .slice(0, 5)
                .map(async ([playerId, totals]) => {
                    const user = playerId.startsWith("platform:")
                        ? null
                        : await getUserByIdentifier(ctx, playerId)
                    const playerIdentifiers = new Set([
                        playerId,
                        user ? getUserStableId(user) : "",
                        user ? getUserDiscordId(user) : "",
                    ])
                    const roles = rosters.flatMap(
                        (roster) =>
                            roster?.squads.flatMap((squad) =>
                                squad.players
                                    .filter(
                                        (player) =>
                                            player.id &&
                                            playerIdentifiers.has(player.id)
                                    )
                                    .map((player) => ({
                                        name: player.roleName ?? "Role",
                                        icon: player.roleIcon,
                                    }))
                            ) ?? []
                    )
                    const uniqueRoles = [
                        ...new Map(
                            roles.map((role) => [
                                `${role.name}:${role.icon ?? ""}`,
                                role,
                            ])
                        ).values(),
                    ]
                    const guildNickname = [
                        guildId,
                        server.discordId,
                        server.id,
                        String(server._id),
                    ]
                        .map((identifier) =>
                            identifier
                                ? user?.nicknames?.[identifier]?.trim()
                                : undefined
                        )
                        .find((nickname): nickname is string =>
                            Boolean(nickname)
                        )
                    return {
                        id: playerId,
                        name: guildNickname || user?.name || totals.name,
                        matches: totals.matches,
                        kills: totals.kills,
                        deaths: totals.deaths,
                        roles: uniqueRoles,
                    }
                })
        )

        return {
            recentMatches,
            wins,
            losses,
            winRate: decided ? wins / decided : 0,
            topPlayers,
        }
    },
})
