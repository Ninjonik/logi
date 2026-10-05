import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"

import type { TopicPresetInput } from "@/lib/validation/topic-preset"
import { getInternalAuthSecret } from "@/lib/env"

const upsertTopicPresetReference = makeFunctionReference<"mutation">(
    "topicPresets:upsert"
)
const removeTopicPresetReference = makeFunctionReference<"mutation">(
    "topicPresets:remove"
)

export type PresetDeletionResult =
    | { ok: true }
    | { ok: false; error: "not_found" }
    | { ok: false; error: "in_use"; eventCount: number }

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

/** Deletes a clan's topic preset; refused while an open event still uses it. */
export async function deleteTopicPreset(input: {
    serverId: string
    presetId: string
}): Promise<PresetDeletionResult> {
    return (await fetchMutation(removeTopicPresetReference, {
        secret: getInternalAuthSecret(),
        serverId: input.serverId as never,
        presetId: input.presetId as never,
    })) as PresetDeletionResult
}
