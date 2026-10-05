import {
    acknowledgeRosterAttendance,
    setRosterAttendanceStatus,
} from "@/domain/rosters/attendance-policy"
import { declineRosterAttendance } from "@/domain/rosters/attendance-decline"
import type { EventWorkflowRepository } from "@/application/events/ports"
import { normalizeEventRecord } from "@/domain/events/normalization"
import { mergeRosterWithEventState } from "@/domain/rosters/sync"
import type { AttendanceStatus } from "@/domain/rosters/types"
import type { Clock } from "@/application/ports/clock"
import type { GameId } from "@/domain/games/game"

export type RosterCommandRecord = {
    id: string
    eventId: string
    gameId?: GameId
    squadPresetId?: string
    squads: Array<{
        name: string
        group: string
        order: number
        color: string
        icon?: string
        players: Array<{
            id?: string
            customName?: string
            ack: boolean
            confirmed?: boolean
            note?: string
            roleName?: string
            roleIcon?: string
        }>
    }>
    reservePlayerIds: string[]
    reserveAttendances?: Array<{
        userId: string
        ack: boolean
        confirmed?: boolean
    }>
    notAttendingPlayerIds: string[]
    streamerId?: string
    published: boolean
}

type EventRosterRecord = {
    guildId: string
    gameId?: GameId
    registrationEnd: string
    participants?: Array<{
        userId: string
        status: "attending" | "not_attending"
        group?: string | null
        updatedAt: string
    }>
    signUps?: Array<{ userId: string; group?: string | null }>
    updatedAt?: string
    createdAt?: string
}

type AssignmentRosterRecord = {
    userId: string
    serverId: string
    createdAt: string
}

export interface RosterCommandRepository {
    getRosterById(rosterId: string): Promise<RosterCommandRecord | null>
    getRosterByEventId(eventId: string): Promise<RosterCommandRecord | null>
    getEvent(eventId: string): Promise<EventRosterRecord | null>
    listAssignments(
        serverDiscordId: string,
        gameId?: GameId
    ): Promise<AssignmentRosterRecord[]>
    createRoster(roster: Omit<RosterCommandRecord, "id">): Promise<string>
    updateRoster(
        rosterId: string,
        roster: Omit<RosterCommandRecord, "id">
    ): Promise<void>
}

export type UpsertRosterInput = Omit<RosterCommandRecord, "id"> & {
    rosterId?: string
}

function buildPersistedRosterPayload(roster: Omit<RosterCommandRecord, "id">) {
    return {
        eventId: roster.eventId,
        gameId: roster.gameId,
        squadPresetId: roster.squadPresetId,
        squads: roster.squads,
        reservePlayerIds: roster.reservePlayerIds,
        reserveAttendances: roster.reserveAttendances ?? [],
        notAttendingPlayerIds: roster.notAttendingPlayerIds,
        streamerId: roster.streamerId,
        published: roster.published,
    }
}

export class UpsertRosterUseCase {
    constructor(private readonly repository: RosterCommandRepository) {}

    async execute(input: UpsertRosterInput) {
        const event = await this.repository.getEvent(input.eventId)
        const assignments = event
            ? await this.repository.listAssignments(event.guildId, event.gameId)
            : []
        const existing = input.rosterId
            ? await this.repository.getRosterById(input.rosterId)
            : await this.repository.getRosterByEventId(input.eventId)

        const merged = event
            ? mergeRosterWithEventState(
                  {
                      ...(existing ?? {}),
                      ...input,
                      gameId: event.gameId,
                      reserveAttendances:
                          input.reserveAttendances ??
                          existing?.reserveAttendances ??
                          [],
                  } as RosterCommandRecord,
                  event,
                  assignments,
                  new Date(),
                  { preservePlacedUsers: true }
              )
            : {
                  ...(existing ?? {}),
                  ...input,
                  reserveAttendances:
                      input.reserveAttendances ??
                      existing?.reserveAttendances ??
                      [],
              }

        const payload = buildPersistedRosterPayload(merged)

        if (existing) {
            await this.repository.updateRoster(existing.id, payload)
            return existing.id
        }

        return await this.repository.createRoster(payload)
    }
}

export class UpdateRosterAttendanceUseCase {
    constructor(
        private readonly repository: Pick<
            RosterCommandRepository,
            "getRosterByEventId" | "updateRoster"
        >
    ) {}

    async acknowledge(eventId: string, userId: string) {
        return await this.update(eventId, userId, (roster, nextUserId) =>
            acknowledgeRosterAttendance(roster, nextUserId)
        )
    }

    async setStatus(eventId: string, userId: string, status: AttendanceStatus) {
        return await this.update(eventId, userId, (roster, nextUserId) =>
            setRosterAttendanceStatus(roster, nextUserId, status)
        )
    }

    private async update(
        eventId: string,
        userId: string,
        mutate: (
            roster: RosterCommandRecord,
            nextUserId: string
        ) => RosterCommandRecord
    ) {
        const roster = await this.repository.getRosterByEventId(eventId)
        if (!roster) {
            throw new Error("Roster not found.")
        }

        const next = mutate(roster, userId)
        await this.repository.updateRoster(
            roster.id,
            buildPersistedRosterPayload(next)
        )
        return { ok: true as const }
    }
}

/**
 * A rostered player declines after the roster is published ("Can't make it"
 * in the reminder DM): an absence notice with their reason, a withdrawn
 * attendance confirmation and one "declined" entry in the sign-up history the
 * organisers read. Repeating the same decline writes nothing.
 */
export class DeclineRosterAttendanceUseCase {
    constructor(
        private readonly rosters: Pick<
            RosterCommandRepository,
            "getRosterByEventId" | "updateRoster"
        >,
        private readonly events: Pick<
            EventWorkflowRepository,
            "getById" | "saveAbsenceNotices" | "appendSignupActivity"
        >,
        private readonly clock: Clock
    ) {}

    async execute(input: {
        guildId: string
        eventId: string
        userId: string
        reason: string
    }) {
        const event = await this.events.getById(input.eventId)
        const roster = await this.rosters.getRosterByEventId(input.eventId)
        if (!event || event.guildId !== input.guildId || !roster)
            throw new Error("Attendance unavailable.")
        const now = this.clock.now()
        const normalized = normalizeEventRecord(event, now)
        const decision = declineRosterAttendance({
            roster,
            event: {
                gameStart: normalized.gameStart ?? normalized.meetingStart,
                status: normalized.status,
                absenceNotices: normalized.absenceNotices,
            },
            userId: input.userId,
            reason: input.reason,
            now,
        })
        if (!decision.changed) return { ok: true as const, changed: false }

        const occurredAt = now.toISOString()
        await this.events.saveAbsenceNotices(input.eventId, {
            absenceNotices: decision.absenceNotices,
            updatedAt: occurredAt,
        })
        await this.rosters.updateRoster(
            roster.id,
            buildPersistedRosterPayload(decision.roster)
        )
        await this.events.appendSignupActivity({
            guildId: event.guildId,
            eventId: input.eventId,
            eventName: event.name ?? "",
            eventKind: event.kind ?? "match",
            userId: input.userId,
            action: "declined",
            role:
                decision.placement.kind === "slot"
                    ? [
                          decision.placement.squadName,
                          decision.placement.roleName,
                      ]
                          .filter(Boolean)
                          .join(" · ")
                    : null,
            previousRole: null,
            occurredAt,
        })
        return { ok: true as const, changed: true }
    }
}
