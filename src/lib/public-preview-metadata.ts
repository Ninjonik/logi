import { cacheLife, cacheTag } from "next/cache";

import { appCacheTags } from "@/lib/cache-tags";

type PublicPreview = { title: string; description: string; imageVersion: string };

/** Native fetch is intentional: unlike convex/nextjs fetchQuery it does not
 * read request context, so Next can cache it while resolving metadata. */
export async function getMatchPreviewMetadata(eventId: string): Promise<PublicPreview | null> {
  "use cache";
  cacheLife("max");
  cacheTag(appCacheTags.publicMatch(eventId));
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return null;
  const response = await fetch(`${convexUrl}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "publicPreviews:get", args: { entityType: "match", entityId: eventId }, format: "json" }),
  });
  if (!response.ok) return null;
  const result = await response.json() as { status: "success" | "error"; value?: PublicPreview | null };
  return result.status === "success" ? result.value ?? null : null;
}
