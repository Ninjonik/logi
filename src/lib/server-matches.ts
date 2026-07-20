import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { appCacheTags, tagCacheEntries } from "@/lib/cache-tags";
import { getInternalAuthSecret } from "@/lib/env";
import type { MatchRecord } from "@/types/domain";

const upsertMatchForEventReference = makeFunctionReference<"mutation">("matchStats:upsertForEvent");
const getMatchByEventIdReference = makeFunctionReference<"query">("matchStats:getByEventId");

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
  "use cache";
  if (eventId.startsWith("sample-")) return null;
  tagCacheEntries([appCacheTags.match(eventId)]);
  return await fetchQuery(getMatchByEventIdReference, {
    eventId: eventId as never,
  }) as MatchRecord | null;
}
