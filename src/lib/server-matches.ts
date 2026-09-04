import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { appCacheTags, cachedRead } from "@/lib/cache-tags";
import { getInternalAuthSecret } from "@/lib/env";
import type { MatchRecord } from "@/types/domain";

const upsertMatchForEventReference = makeFunctionReference<"mutation">("matchStats:upsertForEvent");
const getMatchByEventIdReference = makeFunctionReference<"query">("matchStats:getByEventId");
const findMatchByIdentityReference = makeFunctionReference<"query">("matchStats:findByIdentity");

export async function saveServerMatch(input: {
  eventId: string;
  sourceUrl: string;
  raw: MatchRecord["raw"];
}) {
  return await fetchMutation(upsertMatchForEventReference, {
    secret: getInternalAuthSecret(),
    eventId: input.eventId as never,
    sourceUrl: input.sourceUrl,
    raw: input.raw,
  });
}

export async function getServerMatchByEventId(eventId: string) {
  if (eventId.startsWith("sample-")) return null;
  return await cachedRead(["server-match", eventId], [appCacheTags.match(eventId)], () => fetchQuery(getMatchByEventIdReference, {
    eventId: eventId as never,
  }) as Promise<MatchRecord | null>);
}

export async function findServerMatchByIdentity(input: {
  guildId: string;
  sourceUrl: string;
  matchId?: string;
}) {
  return await fetchQuery(findMatchByIdentityReference, {
    guildId: input.guildId,
    sourceUrl: input.sourceUrl,
    matchId: input.matchId,
  }) as MatchRecord | null;
}
