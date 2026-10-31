import {
    UpsertRosterUseCase,
    type RosterCommandRepository,
    type UpsertRosterInput,
} from "./roster-commands.use-case"
import { resolveGameScope } from "../../domain/games/game"
import type { Clock } from "../ports/clock"

export type RosterPublicationChoice = {
    variant: "photo_text" | "photo"
    mentionPlayers: boolean
}
export interface RosterManagementRepository extends RosterCommandRepository {
    getPreset(id: string): Promise<{ guildId: string; gameId?: string } | null>
    publish(input: {
        rosterId: string
        eventId: string
        guildId: string
        publishedAt: string
        firstPublish: boolean
        requestedBy?: string
        choice?: RosterPublicationChoice
    }): Promise<void>
    delete(rosterId: string): Promise<void>
}

/** Common save invariants and publication lifecycle, after the caller authenticates its actor. */
export class ManageRoster {
    constructor(
        private readonly repository: RosterManagementRepository,
        private readonly clock: Clock
    ) {}
    async save(
        input: UpsertRosterInput & {
            guildId: string
            requestedBy?: string
            discordPublish?: RosterPublicationChoice
        }
    ) {
        const event = await this.repository.getEvent(input.eventId)
        if (!event || event.guildId !== input.guildId)
            throw new Error("Event not found.")
        const existing = input.rosterId
            ? await this.repository.getRosterById(input.rosterId)
            : await this.repository.getRosterByEventId(input.eventId)
        if (
            (input.rosterId && !existing) ||
            (existing &&
                (existing.eventId !== input.eventId ||
                    (existing.guildId !== undefined &&
                        existing.guildId !== input.guildId)))
        )
            throw new Error("Roster not found.")
        if (input.squadPresetId) {
            const preset = await this.repository.getPreset(input.squadPresetId)
            if (!preset || preset.guildId !== input.guildId)
                throw new Error("Squad preset not found.")
            if (
                resolveGameScope(event.gameId) !==
                resolveGameScope(preset.gameId)
            )
                throw new Error(
                    "Squad preset does not belong to this event's game."
                )
        }
        const { guildId, requestedBy, discordPublish, ...fields } = input
        const rosterId = await new UpsertRosterUseCase(this.repository).execute(
            fields
        )
        if (fields.published)
            await this.repository.publish({
                rosterId,
                eventId: input.eventId,
                guildId,
                publishedAt: this.clock.now().toISOString(),
                firstPublish: !existing?.published,
                requestedBy,
                choice: discordPublish,
            })
        return rosterId
    }
    async deleteDraft(rosterId: string, guildId?: string) {
        const roster = await this.repository.getRosterById(rosterId)
        if (!roster) throw new Error("Roster not found.")
        const event = await this.repository.getEvent(roster.eventId)
        if (
            guildId !== undefined &&
            (!event ||
                event.guildId !== guildId ||
                (roster.guildId !== undefined && roster.guildId !== guildId))
        )
            throw new Error("Roster not found.")
        if (roster.published)
            throw new Error("Published rosters cannot be deleted.")
        await this.repository.delete(rosterId)
    }
}
