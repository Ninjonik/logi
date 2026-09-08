import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"

const ensurePreview = makeFunctionReference<"mutation">("publicPreviews:ensure")

export async function ensurePublicMatchPreview(eventId: string) {
    return await fetchMutation(ensurePreview, {
        entityType: "match",
        entityId: eventId,
    })
}
