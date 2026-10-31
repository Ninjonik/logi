import type {
    SquadPresetFields,
    TopicPresetFields,
} from "../../domain/presets/preset"
import { DISCORD_MESSAGE_MAX_ATTACHMENTS } from "../../domain/discord-sync/attachment-limits"
import { resolveGameScope } from "../../domain/games/game"
import type { Clock } from "../ports/clock"

export type PresetRecord<T> = T & {
    id: string
    guildId: string
    createdAt: string
    updatedAt: string
}
export interface PresetRepository<T> {
    get(id: string): Promise<PresetRecord<T> | null>
    create(
        record: T & { guildId: string; createdAt: string; updatedAt: string }
    ): Promise<string>
    update(id: string, fields: T & { updatedAt: string }): Promise<void>
}

async function persist<T>(
    repository: PresetRepository<T>,
    clock: Clock,
    guildId: string,
    presetId: string | undefined,
    fields: T
) {
    const existing = presetId ? await repository.get(presetId) : null
    if (presetId && (!existing || existing.guildId !== guildId))
        throw new Error("Preset not found.")
    const now = clock.now().toISOString()
    if (existing) {
        await repository.update(existing.id, { ...fields, updatedAt: now })
        return { ...existing, ...fields, updatedAt: now }
    }
    const record = { ...fields, guildId, createdAt: now, updatedAt: now }
    return { ...record, id: await repository.create(record) }
}

export async function saveTopicPreset(
    repository: PresetRepository<TopicPresetFields>,
    clock: Clock,
    input: TopicPresetFields & { guildId: string; presetId?: string }
) {
    const name = input.name.trim()
    if (
        !name ||
        !input.topics.length ||
        input.topics.some((topic) => !topic.title.trim())
    )
        throw new Error(
            "Preset name and at least one named topic are required."
        )
    if (
        input.topics.some(
            (topic) =>
                topic.attachments.length > DISCORD_MESSAGE_MAX_ATTACHMENTS ||
                topic.messages?.some(
                    (message) =>
                        message.attachments.length >
                        DISCORD_MESSAGE_MAX_ATTACHMENTS
                )
        )
    )
        throw new Error(
            `A Discord message can have at most ${DISCORD_MESSAGE_MAX_ATTACHMENTS} attachments.`
        )
    // Topics and messages are supplied data: neither runtime generates IDs or a default message.
    return persist(repository, clock, input.guildId, input.presetId, {
        name,
        side: input.side?.trim() || undefined,
        map: input.map?.trim() || undefined,
        cap: input.cap?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        topics: input.topics,
    })
}

export async function saveSquadPreset(
    repository: PresetRepository<SquadPresetFields>,
    clock: Clock,
    input: SquadPresetFields & { guildId: string; presetId?: string }
) {
    const name = input.name.trim()
    if (!name || !input.squads.length)
        throw new Error("Preset name and at least one squad are required.")
    const existing = input.presetId
        ? await repository.get(input.presetId)
        : null
    if (input.presetId && (!existing || existing.guildId !== input.guildId))
        throw new Error("Preset not found.")
    if (
        existing &&
        input.gameId !== undefined &&
        resolveGameScope(existing.gameId) !== resolveGameScope(input.gameId)
    )
        throw new Error("A squad preset game cannot be changed.")
    // Preserve caller-assigned order numbers; array position is not squad order.
    return persist(repository, clock, input.guildId, input.presetId, {
        gameId: existing ? resolveGameScope(existing.gameId) : input.gameId,
        name,
        squads: input.squads,
    })
}
