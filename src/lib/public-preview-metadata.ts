import { appCacheTags, cachedRead } from "@/lib/cache-tags";

type PublicPreview = { title: string; description: string; imageVersion: string };

/** Native fetch is intentional: unlike convex/nextjs fetchQuery it does not
 * read request context, so Next can cache it while resolving metadata. */
export async function getPublicPreviewMetadata(
  entityType: "player" | "clan" | "match",
  entityId: string,
): Promise<PublicPreview | null> {
  const tag = entityType === "match" ? appCacheTags.publicMatch(entityId) : entityType === "clan" ? appCacheTags.publicClan(entityId) : appCacheTags.publicProfile(entityId);
  return await cachedRead(["public-preview", entityType, entityId], [tag], async () => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) return null;
    const response = await fetch(`${convexUrl}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "publicPreviews:get", args: { entityType, entityId }, format: "json" }),
    });
    if (!response.ok) return null;
    const result = await response.json() as { status: "success" | "error"; value?: PublicPreview | null };
    return result.status === "success" ? result.value ?? null : null;
  }, 86400);
}

export async function getMatchPreviewMetadata(eventId: string) {
  return await getPublicPreviewMetadata("match", eventId);
}
