export type CompetitionFixture = {
  id: string;
  divisionId?: string;
  teamAId: string;
  teamBId: string;
  scoreA?: number;
  scoreB?: number;
  status: "scheduled" | "final" | "forfeit";
};

export type CompetitionTeam = { id: string; name: string; withdrawn?: boolean };

export type Standing = {
  teamId: string;
  name: string;
  capScore: number;
  regularWins: number;
  totalWins: number;
  regularMatches: number;
  totalMatches: number;
};

/** ECL scores are cap points: a 5–0 result awards five to the winner and
 * zero to the opponent. Forfeits count as total, but not regular, matches. */
export function deriveDivisionStandings(teams: CompetitionTeam[], fixtures: CompetitionFixture[]) {
  const rows = new Map(teams.map((team) => [team.id, {
    teamId: team.id, name: team.name, capScore: 0, regularWins: 0, totalWins: 0, regularMatches: 0, totalMatches: 0,
  } satisfies Standing]));
  for (const fixture of fixtures) {
    if (fixture.status !== "final" && fixture.status !== "forfeit") continue;
    if (fixture.scoreA === undefined || fixture.scoreB === undefined) continue;
    const left = rows.get(fixture.teamAId); const right = rows.get(fixture.teamBId);
    if (!left || !right) continue;
    left.capScore += fixture.scoreA; right.capScore += fixture.scoreB;
    left.totalMatches++; right.totalMatches++;
    if (fixture.status === "final") { left.regularMatches++; right.regularMatches++; }
    if (fixture.scoreA > fixture.scoreB) { left.totalWins++; if (fixture.status === "final") left.regularWins++; }
    if (fixture.scoreB > fixture.scoreA) { right.totalWins++; if (fixture.status === "final") right.regularWins++; }
  }
  return [...rows.values()].sort((a, b) => b.capScore - a.capScore || b.regularWins - a.regularWins || b.totalWins - a.totalWins || a.totalMatches - b.totalMatches || a.name.localeCompare(b.name));
}
