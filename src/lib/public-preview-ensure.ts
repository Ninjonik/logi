import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { fetchMutation } from "convex/nextjs"

const ensurePreview = makeFunctionReference<"mutation">("publicPreviews:ensure")

export async function ensurePublicMatchPreview(eventId: string) {
    return await fetchMutation(ensurePreview, {
        secret: getInternalAuthSecret(),
        entityType: "match",
        entityId: eventId,
    })
}
