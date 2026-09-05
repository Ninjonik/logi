import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { cachedRead, appCacheTags } from "@/lib/cache-tags";
import { getInternalAuthSecret } from "@/lib/env";

const getPublicReference = makeFunctionReference<"query">("competitions:getPublic");
const seedReference = makeFunctionReference<"mutation">("competitions:seedEcl2026");
const saveFixtureReference = makeFunctionReference<"mutation">("competitions:saveFixture");
const listGuildsReference = makeFunctionReference<"query">("competitions:listGuilds");
const mergeGuildsReference = makeFunctionReference<"mutation">("competitions:mergeGuilds");
const linkEventReference = makeFunctionReference<"mutation">("competitions:linkEvent");
export type PublicCompetition = { id: string; slug: string; name: string; season: string; divisions: Array<{ id: string; name: string; teams: Array<{ id: string; name: string; withdrawn: boolean }>; fixtures: Array<{ id: string; phase: "league" | "playoff" | "relegation"; teamAId: string; teamBId: string; scoreA?: number; scoreB?: number; status: "scheduled" | "final" | "forfeit"; scheduledAt?: string; eventId?: string }> }> };

export async function getPublicCompetition(slug: string) {
  return await cachedRead(["competition", slug], [appCacheTags.competition(slug)], async () => (await fetchQuery(getPublicReference, { slug })) as PublicCompetition | null, 300);
}
export async function seedEclCompetition() { return await fetchMutation(seedReference, { secret: getInternalAuthSecret() }); }
export async function saveCompetitionFixture(input: { competitionId: string; divisionId?: string; phase: "league" | "playoff" | "relegation"; teamAId: string; teamBId: string; scoreA?: number; scoreB?: number; status: "scheduled" | "final" | "forfeit" }) { return await fetchMutation(saveFixtureReference, { secret: getInternalAuthSecret(), ...input, competitionId: input.competitionId as never, divisionId: input.divisionId as never, teamAId: input.teamAId as never, teamBId: input.teamBId as never }); }
export async function listCompetitionGuilds() { return (await fetchQuery(listGuildsReference, {})) as Array<{ id: string; name: string; isGhost: boolean }>; }
export async function mergeCompetitionGuilds(primaryGuildId: string, secondaryGuildId: string) { return await fetchMutation(mergeGuildsReference, { secret: getInternalAuthSecret(), primaryGuildId: primaryGuildId as never, secondaryGuildId: secondaryGuildId as never }); }
export async function linkCompetitionEvent(input: { competitionId: string; divisionId?: string; eventId: string; teamAId: string; teamBId: string }) { return await fetchMutation(linkEventReference, { secret: getInternalAuthSecret(), competitionId: input.competitionId as never, divisionId: input.divisionId as never, eventId: input.eventId as never, teamAId: input.teamAId as never, teamBId: input.teamBId as never }); }
