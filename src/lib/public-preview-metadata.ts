import { appCacheTags, cachedRead } from "@/lib/cache-tags"
import { getInternalAuthSecret } from "@/lib/env"

type PublicPreview = {
    title: string
    description: string
    imageVersion: string
}

/** Native fetch is intentional: unlike convex/nextjs fetchQuery it does not
 * read request context, so Next can cache it while resolving metadata. */
export async function getPublicPreviewMetadata(
    entityType: "player" | "clan" | "match",
    entityId: string
): Promise<PublicPreview | null> {
    const tag =
        entityType === "match"
            ? appCacheTags.publicMatch(entityId)
            : entityType === "clan"
              ? appCacheTags.publicClan(entityId)
              : appCacheTags.publicProfile(entityId)
    // A failed read throws inside the cache so it is not stored for a day;
    // the page then renders without a preview.
    return await cachedRead(
        ["public-preview", entityType, entityId],
        [tag],
        async () => {
            const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
            if (!convexUrl) return null
            const response = await fetch(`${convexUrl}/api/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: "publicPreviews:get",
                    args: {
                        secret: getInternalAuthSecret(),
                        entityType,
                        entityId,
                    },
                    format: "json",
                }),
            })
            if (!response.ok) throw new Error("Preview read failed.")
            const result = (await response.json()) as {
                status: "success" | "error"
                value?: PublicPreview | null
            }
            if (result.status !== "success")
                throw new Error("Preview read failed.")
            return result.value ?? null
        },
        86400
    ).catch(() => null)
}

export async function getMatchPreviewMetadata(eventId: string) {
    return await getPublicPreviewMetadata("match", eventId)
}
