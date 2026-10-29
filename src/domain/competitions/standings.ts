export type CompetitionFixture = {
    id: string
    divisionId?: string
    teamAId: string
    teamBId: string
    participantTeamIds?: string[]
    participantScores?: Array<number | null>
    scoreA?: number
    scoreB?: number
    status: "scheduled" | "final" | "forfeit"
}

export type CompetitionTeam = { id: string; name: string; withdrawn?: boolean }

export type Standing = {
    teamId: string
    name: string
    capScore: number
    regularWins: number
    totalWins: number
    regularMatches: number
    totalMatches: number
}

/** ECL scores are cap points: a 5–0 result awards five to the winner and
 * zero to the opponent. Forfeits count as total, but not regular, matches. */
export function deriveDivisionStandings(
    teams: CompetitionTeam[],
    fixtures: CompetitionFixture[]
) {
    const rows = new Map(
        teams.map((team) => [
            team.id,
            {
                teamId: team.id,
                name: team.name,
                capScore: 0,
                regularWins: 0,
                totalWins: 0,
                regularMatches: 0,
                totalMatches: 0,
            } satisfies Standing,
        ])
    )
    for (const fixture of fixtures) {
        if (fixture.status !== "final" && fixture.status !== "forfeit") continue
        const ids = fixture.participantTeamIds?.length
            ? fixture.participantTeamIds
            : [fixture.teamAId, fixture.teamBId]
        const scores = fixture.participantScores ?? [
            fixture.scoreA,
            fixture.scoreB,
        ]
        if (
            ids.length < 2 ||
            new Set(ids).size !== ids.length ||
            scores.length !== ids.length
        )
            continue
        if (
            scores.some(
                (score) =>
                    typeof score !== "number" ||
                    !Number.isFinite(score) ||
                    score < 0
            ) ||
            ids.some((id) => !rows.has(id))
        )
            continue
        const highest = Math.max(...scores.map((score) => score ?? 0))
        const uniqueWinner =
            scores.filter((score) => score === highest).length === 1
        for (let index = 0; index < ids.length; index++) {
            const row = rows.get(ids[index])!
            const score = scores[index]!
            row.capScore += score
            row.totalMatches++
            if (fixture.status === "final") row.regularMatches++
            if (uniqueWinner && score === highest) {
                row.totalWins++
                if (fixture.status === "final") row.regularWins++
            }
        }
    }
    return [...rows.values()].sort(
        (a, b) =>
            b.capScore - a.capScore ||
            b.regularWins - a.regularWins ||
            b.totalWins - a.totalWins ||
            a.totalMatches - b.totalMatches ||
            a.name.localeCompare(b.name)
    )
}
