import type {
    EventWorkflowRecord,
    EventWorkflowRepository,
    EventWorkflowSyncPort,
} from "@/application/events/ports"
import type { GameId } from "@/domain/games/game"

export class InMemoryEventWorkflowRepository implements EventWorkflowRepository {
    public readonly signupActivities: Array<{
        guildId: string
        eventId: string
        eventName: string
        eventKind: "match" | "training"
        userId: string
        action: "signed_up" | "changed_role" | "unsigned" | "declined"
        role?: string | null
        previousRole?: string | null
        occurredAt: string
    }> = []
    constructor(
        public readonly events: Map<string, EventWorkflowRecord>,
        private readonly assignments = new Map<
            string,
            {
                primaryGroupId?: string
                type?: "member" | "reserve_member" | "mercenary"
                status?: "pending" | "recruit" | "active"
            }
        >(),
        private readonly groupNames = new Map<string, string>()
    ) {}

    async getById(eventId: string): Promise<EventWorkflowRecord | null> {
        return this.events.get(eventId) ?? null
    }

    async getAssignmentForUser(
        serverId: string,
        userId: string,
        gameId?: GameId
    ) {
        return (
            this.assignments.get(`${serverId}:${userId}:${gameId ?? ""}`) ??
            this.assignments.get(`${serverId}:${userId}`) ??
            null
        )
    }

    async getGroupNameById(groupId: string) {
        return this.groupNames.get(groupId) ?? null
    }

    async getReservePlayerIds(_eventId: string) {
        return []
    }

    async saveSignupState(
        eventId: string,
        input: {
            participants: EventWorkflowRecord["participants"]
            signUps: EventWorkflowRecord["signUps"]
            updatedAt: string
        }
    ): Promise<void> {
        const event = this.events.get(eventId)
        if (!event) {
            return
        }

        this.events.set(eventId, {
            ...event,
            participants: input.participants,
            signUps: input.signUps,
            updatedAt: input.updatedAt,
        })
    }

    async saveAbsenceNotices(
        eventId: string,
        input: {
            absenceNotices: EventWorkflowRecord["absenceNotices"]
            updatedAt: string
        }
    ): Promise<void> {
        const event = this.events.get(eventId)
        if (!event) {
            return
        }

        this.events.set(eventId, {
            ...event,
            absenceNotices: input.absenceNotices,
            updatedAt: input.updatedAt,
        })
    }

    async appendSignupActivity(
        input: (typeof this.signupActivities)[number]
    ): Promise<void> {
        this.signupActivities.push(input)
    }
}

export class NoopEventWorkflowSyncPort implements EventWorkflowSyncPort {
    public readonly calls: Array<{ eventId: string; userId: string }> = []

    async syncRosterMembershipForUser(
        eventId: string,
        userId: string
    ): Promise<void> {
        this.calls.push({ eventId, userId })
    }
}
