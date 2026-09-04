import { fetchMutation } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

const ensurePreview = makeFunctionReference<"mutation">("publicPreviews:ensure");

export async function ensurePublicMatchPreview(eventId: string) {
  return await fetchMutation(ensurePreview, { entityType: "match", entityId: eventId });
}
