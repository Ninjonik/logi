"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { PublicCompetition } from "@/lib/read-models/competitions";
import type { Dictionary } from "@/i18n/dictionaries";

export function CompetitionFixtureForm({ competition, dictionary }: { competition: PublicCompetition; dictionary: Dictionary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [divisionId, setDivisionId] = useState(competition.divisions[0]?.id ?? "");
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const teams = competition.divisions.find((division) => division.id === divisionId)?.teams ?? [];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const response = await fetch("/api/competitions/fixtures", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ competitionId: competition.id, divisionId, teamAId, teamBId, scoreA, scoreB, status: "final" }) });
      const body = await response.json();
      if (!response.ok) { toast.error(body.error ?? dictionary.competition.resultSaveFailed); return; }
      toast.success(dictionary.competition.resultSaved); router.refresh();
    });
  }

  return <form onSubmit={submit} className="space-y-4 rounded-xl border bg-muted/20 p-4 sm:p-5">
    <div><h2 className="font-medium">{dictionary.competition.manualResult}</h2><p className="mt-1 text-sm text-muted-foreground">{dictionary.competition.manualResultDescription}</p></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 col-span-2"><Label htmlFor="division">{dictionary.competition.division}</Label><select id="division" value={divisionId} onChange={(event) => { setDivisionId(event.target.value); setTeamAId(""); setTeamBId(""); }} className="h-10 w-full rounded-md border bg-background px-3">{competition.divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="team-a">Team A</Label><select id="team-a" required value={teamAId} onChange={(event) => setTeamAId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3"><option value="">Choose team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="team-b">Team B</Label><select id="team-b" required value={teamBId} onChange={(event) => setTeamBId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3"><option value="">Choose team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="score-a">Team A score</Label><input id="score-a" required type="number" min="0" value={scoreA} onChange={(event) => setScoreA(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3" /></div><div className="space-y-2"><Label htmlFor="score-b">Team B score</Label><input id="score-b" required type="number" min="0" value={scoreB} onChange={(event) => setScoreB(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3" /></div>
    </div>
    <Button type="submit" disabled={pending || !teamAId || !teamBId || teamAId === teamBId}>{pending ? dictionary.competition.saving : dictionary.competition.saveResult}</Button>
  </form>;
}
