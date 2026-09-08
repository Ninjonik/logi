import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"

import type { TopicPresetInput } from "@/lib/validation/topic-preset"
import { getInternalAuthSecret } from "@/lib/env"

const upsertTopicPresetReference = makeFunctionReference<"mutation">(
    "topicPresets:upsert"
)

export async function saveTopicPreset(
    input: TopicPresetInput & {
        serverId: string
        presetId?: string
    }
) {
    return await fetchMutation(upsertTopicPresetReference, {
        secret: getInternalAuthSecret(),
        serverId: input.serverId,
        presetId: input.presetId as never,
        name: input.name,
        side: input.side,
        map: input.map,
        cap: input.cap,
        notes: input.notes,
        topics: input.topics,
    })
}
