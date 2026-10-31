import {
    buildDefaultStratmapState,
    stringifyStratmapState,
} from "../../lib/stratmaps"
import { resolveGameScope } from "../../domain/games/game"
import { isDraftEvent } from "../../domain/events/drafts"
import type { Clock } from "../ports/clock"

export type StratmapFields = {
    gameId?: string
    eventId?: string
    title: string
    description?: string
    baseMapId: string
    side?: string
    strongpointId?: string
    state: string
}
export type StratmapRecord = StratmapFields & {
    id: string
    guildId: string
    createdBy: string
    createdAt: string
    updatedAt: string
}
export interface StratmapRepository {
    get(id: string): Promise<StratmapRecord | null>
    getEvent(
        id: string
    ): Promise<{ guildId: string; gameId?: string; isDraft?: boolean } | null>
    create(record: Omit<StratmapRecord, "id">): Promise<string>
    update(
        id: string,
        fields: StratmapFields & { updatedAt: string }
    ): Promise<void>
}
export async function saveStratmap(
    repository: StratmapRepository,
    clock: Clock,
    input: Omit<StratmapFields, "state"> & {
        state?: string
        stratmapId?: string
        guildId: string
        createdBy: string
        allowDraftEvent?: boolean
    }
) {
    const existing = input.stratmapId
        ? await repository.get(input.stratmapId)
        : null
    if (input.stratmapId && (!existing || existing.guildId !== input.guildId))
        throw new Error("Stratmap not found.")
    if (
        existing &&
        input.gameId !== undefined &&
        resolveGameScope(existing.gameId) !== resolveGameScope(input.gameId)
    )
        throw new Error("A stratmap game cannot be changed.")
    const gameId = existing?.gameId ?? input.gameId ?? "hell_let_loose"
    if (input.eventId) {
        const event = await repository.getEvent(input.eventId)
        if (
            !event ||
            event.guildId !== input.guildId ||
            (!input.allowDraftEvent && isDraftEvent(event))
        )
            throw new Error("Referenced event was not found.")
        if (resolveGameScope(event.gameId) !== resolveGameScope(gameId))
            throw new Error(
                "Referenced event must use the same game as the stratmap."
            )
    }
    const title = input.title.trim(),
        baseMapId = input.baseMapId.trim()
    if (!title || !baseMapId)
        throw new Error("Stratmap title and base map are required.")
    const now = clock.now().toISOString()
    const fields: StratmapFields & { updatedAt: string } = {
        gameId,
        eventId: input.eventId || undefined,
        title,
        baseMapId,
        description: input.description?.trim() || undefined,
        side: input.side?.trim() || undefined,
        strongpointId: input.strongpointId?.trim() || undefined,
        state:
            input.state ??
            existing?.state ??
            stringifyStratmapState(buildDefaultStratmapState(baseMapId)),
        updatedAt: now,
    }
    if (existing) {
        await repository.update(existing.id, fields)
        return { ...existing, ...fields }
    }
    const record = {
        ...fields,
        guildId: input.guildId,
        createdBy: input.createdBy,
        createdAt: now,
    }
    return { ...record, id: await repository.create(record) }
}
