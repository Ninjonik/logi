import { z } from "zod"

import type { PublicCompetition } from "../competitions/competition"
import { deriveDivisionStandings } from "../competitions/standings"
import { DEFAULT_GAME_ID, type GameId } from "../games/game"

/**
 * The public clan page (design J2): the clan's Discord invite, its announced
 * upcoming matches, recent results from the clan's side and its competition
 * placement. Everything here is a projection of data that is already public or
 * that the clan published itself; drafts, trainings, server details and
 * player names never reach it.
 */

const INVITE_CODE = /^[A-Za-z0-9-]{2,64}$/
const INVITE_INPUT_MAX = 200
const DISCORD_GG_HOSTS = new Set(["discord.gg", "www.discord.gg"])
const DISCORD_COM_HOSTS = new Set([
    "discord.com",
    "www.discord.com",
    "discordapp.com",
    "www.discordapp.com",
])

/**
 * A Discord server invite in its canonical `https://discord.gg/<code>` form,
 * or `null` when the input is not one. Only Discord's own invite addresses are
 * accepted, so the public page's "Join on Discord" button cannot point
 * anywhere else.
 */
export function parseDiscordInviteUrl(input: string): string | null {
    const value = input.trim()
    if (!value || value.length > INVITE_INPUT_MAX) return null
    let url: URL
    try {
        url = new URL(
            /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
        )
    } catch {
        return null
    }
    if (url.protocol !== "https:" || url.username || url.password || url.port)
        return null
    const host = url.hostname.toLowerCase()
    const segments = url.pathname.split("/").filter(Boolean)
    const code = DISCORD_GG_HOSTS.has(host)
        ? segments.length === 1
            ? segments[0]
            : null
        : DISCORD_COM_HOSTS.has(host)
          ? segments.length === 2 && segments[0] === "invite"
              ? segments[1]
              : null
          : null
    return code && INVITE_CODE.test(code) ? `https://discord.gg/${code}` : null
}

/** Body of the clan admin's invite setting; `null` removes the invite. */
export const publicInviteInputSchema = z.strictObject({
    inviteUrl: z
        .string()
        .max(INVITE_INPUT_MAX)
        .nullable()
        .transform((value, ctx) => {
            if (value === null || !value.trim()) return null
            const invite = parseDiscordInviteUrl(value)
            if (!invite)
                ctx.addIssue({
                    code: "custom",
                    message: "Not a Discord invite link.",
                })
            return invite
        }),
})
export type PublicInviteInput = z.output<typeof publicInviteInputSchema>

/** What the upcoming-match rule needs to know about a clan event. */
export type UpcomingCandidate = {
    kind?: "match" | "training"
    isDraft?: boolean
    status?: string
    registrationStart?: string
    gameStart: string
}

const time = (value: string | undefined) =>
    value ? Date.parse(value) : Number.NaN

/**
 * A match is public before it is played once it has been announced: it is a
 * match (not a training), not a draft, not concluded, its announcement time
 * has passed (no announcement time means it was announced on creation) and
 * it has not started yet.
 */
export function isPublicUpcomingMatch(
    event: UpcomingCandidate,
    now: number
): boolean {
    if ((event.kind ?? "match") !== "match") return false
    if (event.isDraft === true) return false
    if (event.status === "concluded") return false
    const announceAt = time(event.registrationStart)
    if (event.registrationStart !== undefined && !(announceAt <= now))
        return false
    return time(event.gameStart) > now
}

export type PublicUpcomingMatch = {
    eventId: string
    gameId: GameId
    startsAt: string
    /** Opposing teams from the match's team selection, when known. */
    opponent: string | null
    /** The event's name, shown when no opponent is known. */
    name: string
    /** The published competition the match belongs to, else its category. */
    label: string | null
}

/** Upcoming public matches still in the future at `now`, soonest first. */
export function selectUpcomingPublicMatches(
    matches: readonly PublicUpcomingMatch[],
    now: number,
    limit = 5
): PublicUpcomingMatch[] {
    return matches
        .filter((match) => time(match.startsAt) > now)
        .sort((a, b) => time(a.startsAt) - time(b.startsAt))
        .slice(0, limit)
}

/**
 * The opposing teams of a match from its team selection: every selected team
 * that is not one of the clan's own catalogue teams. Without one of the
 * clan's teams among them the sides cannot be told apart, so nothing is named.
 */
export function matchOpponent(
    matchTeams: ReadonlyArray<{ teamId: string; snapshot: { name: string } }>,
    ownTeamIds: ReadonlySet<string>
): string | null {
    if (!matchTeams.some((team) => ownTeamIds.has(team.teamId))) return null
    const names = matchTeams
        .filter((team) => !ownTeamIds.has(team.teamId))
        .map((team) => team.snapshot.name.trim())
        .filter(Boolean)
    return names.length ? names.join(" / ") : null
}

const GENERIC_SIDE_LABELS = new Set([
    "axis",
    "allies",
    "allied",
    "side a",
    "side b",
    "unknown",
])

/** A recorded match on the public clan page; without an imported result only its map and name are known. */
export type PublicClanResult = {
    eventId: string
    gameId: GameId
    name: string
    endedAt: string
    mapName: string | null
    outcome: "victory" | "defeat" | "draw" | null
    clanScore: number | null
    opponentScore: number | null
    opponent: string | null
}

export type ClanResult = {
    outcome: "victory" | "defeat" | "draw"
    clanScore: number
    opponentScore: number
    opponent: string | null
}

/**
 * An imported result from the clan's side. The import stores Axis as side A
 * and Allies as side B, with the outcome already from the clan's view; the
 * clan's side comes from the event, or from the outcome when the event does
 * not say. A generic side name ("Allies") is not an opponent's name.
 */
export function clanResult(input: {
    side?: string
    result: {
        sideA: string
        sideB: string
        outcome: "victory" | "defeat" | "draw"
        score: { sideA: number; sideB: number }
    }
}): ClanResult {
    const { result } = input
    const side = input.side?.trim().toLowerCase()
    const clanIsA =
        side === "axis"
            ? true
            : side === "allies" || side === "allied"
              ? false
              : result.outcome === "draw"
                ? null
                : result.outcome === "victory"
                  ? result.score.sideA > result.score.sideB
                  : result.score.sideA < result.score.sideB
    const label = (value: string) =>
        value.trim() && !GENERIC_SIDE_LABELS.has(value.trim().toLowerCase())
            ? value.trim()
            : null
    return {
        outcome: result.outcome,
        clanScore: clanIsA === false ? result.score.sideB : result.score.sideA,
        opponentScore:
            clanIsA === false ? result.score.sideA : result.score.sideB,
        opponent:
            clanIsA === null
                ? null
                : label(clanIsA ? result.sideB : result.sideA),
    }
}

export type CompetitionPlacement = {
    slug: string
    name: string
    season: string
    divisionName: string
    divisionCount: number
    /** Place in the division table; `null` before the division has a result. */
    position: number | null
    teamCount: number
}

/**
 * Where the clan's teams stand in published competitions: one entry per
 * division a team of the clan is registered in (withdrawn registrations are
 * left out), in the order the competitions are given.
 */
export function competitionPlacements(
    competitions: readonly PublicCompetition[],
    teamIds: ReadonlySet<string>
): CompetitionPlacement[] {
    return competitions.flatMap((competition) =>
        competition.divisions.flatMap((division) => {
            const team = division.teams.find(
                (entry) => teamIds.has(entry.id) && !entry.withdrawn
            )
            if (!team) return []
            const standings = deriveDivisionStandings(
                division.teams,
                division.fixtures
            )
            const played = standings.some((row) => row.totalMatches > 0)
            const index = standings.findIndex((row) => row.teamId === team.id)
            return [
                {
                    slug: competition.slug,
                    name: competition.name,
                    season: competition.season,
                    divisionName: division.name,
                    divisionCount: competition.divisions.length,
                    position: played && index >= 0 ? index + 1 : null,
                    teamCount: division.teams.length,
                },
            ]
        })
    )
}

/** The games a clan shows publicly; clans from before game selection play Hell Let Loose. */
export function publicClanGames(enabledGames?: readonly GameId[]): GameId[] {
    return enabledGames?.length ? [...new Set(enabledGames)] : [DEFAULT_GAME_ID]
}
