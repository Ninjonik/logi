import { SyncRosterMembershipForUserUseCase } from "@/application/rosters/sync-roster-membership.use-case"
import {
    matchesGameScope,
    resolveGameScope,
    type GameId,
} from "@/domain/games/game"
import {
    sharedMatchGroups,
    sharedInvitationGroups,
} from "./shared-match-groups"
import { rosterRevisionTimestamp } from "../../domain/rosters/shared-roster"
import { sharedMatchMembers, sharedMatchPeople } from "./shared-match-store"
import { syncRosterMembershipForUser } from "../../domain/rosters/sync"
import { sharedSignupLimits } from "../../domain/events/shared-match"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"
import { getUserByDiscordId } from "../../../convex/identity"
import { systemClock } from "@/domain/shared/clock"

import {
    ConvexAssignmentRepository,
    ConvexEventRepository,
    ConvexRosterRepository,
} from "./roster-sync-repositories"
import type {
    EventWorkflowRecord,
    EventWorkflowRepository,
    EventWorkflowSyncPort,
} from "@/application/events/ports"

export class ConvexEventWorkflowRepository implements EventWorkflowRepository {
    constructor(private readonly ctx: MutationCtx) {}

    async assertSignupClan(eventId: string, userId: string) {
        const event = await this.ctx.db.get(eventId as Id<"events">)
        if (!event) throw new Error("Event not found.")
        const { events } = await sharedMatchMembers(this.ctx, event)
        if (events.length === 1) return
        const user = await getUserByDiscordId(this.ctx, userId)
        if (
            user?.guildId &&
            events.some((item) => item.guildId === user.guildId) &&
            user.guildId !== event.guildId
        )
            throw new Error(
                "Sign up through your main clan for this shared match."
            )
        if (user?.guildId === event.guildId) return
        if (
            events.some(
                (item) =>
                    item._id !== event._id &&
                    (item.participants ?? []).some(
                        (person) => person.userId === userId
                    )
            )
        )
            throw new Error(
                "You already have a signup through another clan for this match."
            )
    }

    async getById(eventId: string): Promise<EventWorkflowRecord | null> {
        const event = await this.ctx.db.get(eventId as Id<"events">)
        if (!event || event.sharedAccessRevoked) {
            return null
        }

        const allowed = event.hostEventId
            ? await sharedInvitationGroups(this.ctx, event)
            : undefined
        const signupGroupIds = allowed
            ? (
                  event.signupGroupIds ?? allowed.map((group) => group.groupId)
              ).filter((id) => allowed.some((group) => group.groupId === id))
            : event.signupGroupIds
        const signupGroupLimits = allowed
            ? sharedSignupLimits(
                  allowed,
                  signupGroupIds ?? [],
                  (event.signupGroupLimits ?? []).filter((limit) =>
                      signupGroupIds?.includes(limit.groupId)
                  )
              )
            : event.signupGroupLimits
        return {
            hostEventId: event.hostEventId,
            id: String(event._id),
            guildId: event.guildId,
            name: event.name,
            kind: event.kind,
            gameId: event.gameId,
            signupGroupIds,
            allowedSignupStatuses: event.allowedSignupStatuses,
            allowLateSignups: event.allowLateSignups,
            allowNonMembersSignup: event.allowNonMembersSignup,
            useGeneralSignup:
                event.hostEventId &&
                event.signupGroupIds === undefined &&
                allowed?.length
                    ? false
                    : event.useGeneralSignup,
            allowRankedSignup: event.allowRankedSignup,
            signupGroupLimits,
            isDraft: event.isDraft,
            registrationStart: event.registrationStart,
            registrationEnd: event.registrationEnd,
            meetingStart: event.meetingStart,
            gameStart: event.gameStart,
            gameEnd: event.gameEnd,
            status: event.status,
            participants: event.participants,
            signUps: event.signUps,
            absenceNotices: event.absenceNotices,
            updatedAt: event.updatedAt,
            createdAt: event.createdAt,
        }
    }

    async getAssignmentForUser(
        serverId: string,
        userId: string,
        gameId?: GameId
    ) {
        const assignments = await this.ctx.db
            .query("userAssignments")
            .withIndex("serverId_userId", (q) =>
                q.eq("serverId", serverId).eq("userId", userId)
            )
            .collect()
        const assignment = assignments
            .filter((candidate) => matchesGameScope(candidate.gameId, gameId))
            .sort((left, right) =>
                right.updatedAt.localeCompare(left.updatedAt)
            )[0]

        return assignment
            ? {
                  primaryGroupId: assignment.primaryGroupId
                      ? String(assignment.primaryGroupId)
                      : undefined,
                  secondaryGroupIds:
                      assignment.secondaryGroupIds?.map(String) ?? [],
                  type: assignment.type,
                  status: assignment.status,
              }
            : null
    }

    async getGroupNameById(groupId: string) {
        const group = await this.ctx.db.get(groupId as Id<"groups">)
        return group?.name ?? null
    }

    async getSignupGroupNames(event: EventWorkflowRecord) {
        const stored = await this.ctx.db.get(event.id as Id<"events">)
        const groups = stored ? await sharedMatchGroups(this.ctx, stored) : []
        return groups
            .filter(
                (group) =>
                    matchesGameScope(
                        group.gameId,
                        resolveGameScope(event.gameId)
                    ) &&
                    (!event.signupGroupIds ||
                        event.signupGroupIds.includes(String(group._id)))
            )
            .map((group) => group.name)
    }

    async getReservePlayerIds(eventId: string) {
        const roster = await this.ctx.db
            .query("rosters")
            .withIndex("eventId", (q) =>
                q.eq("eventId", eventId as Id<"events">)
            )
            .unique()

        return roster?.reservePlayerIds ?? []
    }

    async ensureDiscordProfile(input: {
        userId: string
        name: string
        avatar: string
    }) {
        if (!/^\d{17,20}$/.test(input.userId)) return
        const existing = await this.ctx.db
            .query("users")
            .withIndex("discordId", (q) => q.eq("discordId", input.userId))
            .unique()
        if (existing) return
        const conflictingId = await this.ctx.db
            .query("users")
            .withIndex("id", (q) => q.eq("id", input.userId))
            .unique()
        if (conflictingId) return
        const now = new Date().toISOString()
        await this.ctx.db.insert("users", {
            discordId: input.userId,
            id: input.userId,
            name: input.name.trim() || input.userId,
            nicknames: {},
            avatar:
                input.avatar ||
                "https://cdn.discordapp.com/embed/avatars/0.png",
            managedGuildIds: [],
            guildId: undefined,
            mercenaryGuildIds: [],
            isStreamer: false,
            score: 0,
            scores: {},
            performance: undefined,
            createdAt: now,
            updatedAt: now,
        })
    }

    async saveSignupState(
        eventId: string,
        input: {
            participants: EventWorkflowRecord["participants"]
            signUps: EventWorkflowRecord["signUps"]
            updatedAt: string
        }
    ): Promise<void> {
        const event = await this.ctx.db.get(eventId as Id<"events">)
        if (event) {
            const { events } = await sharedMatchMembers(this.ctx, event)
            if (events.length > 1) {
                const before = new Map(
                    (event.participants ?? []).map((person) => [
                        person.userId,
                        JSON.stringify(person),
                    ])
                )
                const changed = new Set(
                    (input.participants ?? [])
                        .filter(
                            (person) =>
                                before.get(person.userId) !==
                                JSON.stringify(person)
                        )
                        .map((person) => person.userId)
                )
                for (const local of events)
                    if (
                        local._id !== event._id &&
                        local.participants?.some((person) =>
                            changed.has(person.userId)
                        )
                    )
                        await this.ctx.db.patch(local._id, {
                            participants: local.participants.filter(
                                (person) => !changed.has(person.userId)
                            ),
                            signUps: (local.signUps ?? []).filter(
                                (person) => !changed.has(person.userId)
                            ),
                            updatedAt: input.updatedAt,
                        })
            }
        }
        await this.ctx.db.patch(eventId as Id<"events">, {
            participants: input.participants ?? [],
            signUps: input.signUps ?? [],
            updatedAt: input.updatedAt,
        })
    }

    async appendSignupActivity(input: {
        guildId: string
        eventId: string
        eventName: string
        eventKind: "match" | "training"
        userId: string
        action: "signed_up" | "changed_role" | "unsigned" | "declined"
        role?: string | null
        previousRole?: string | null
        occurredAt: string
    }): Promise<void> {
        await this.ctx.db.insert("signupActivities", {
            ...input,
            eventId: input.eventId as Id<"events">,
        })
    }

    async saveAbsenceNotices(
        eventId: string,
        input: {
            absenceNotices: EventWorkflowRecord["absenceNotices"]
            updatedAt: string
        }
    ): Promise<void> {
        await this.ctx.db.patch(eventId as Id<"events">, {
            absenceNotices: input.absenceNotices ?? [],
            updatedAt: input.updatedAt,
        })
    }
}

export class ConvexEventWorkflowSyncPort implements EventWorkflowSyncPort {
    constructor(private readonly ctx: MutationCtx) {}

    async syncRosterMembershipForUser(
        eventId: string,
        userId: string
    ): Promise<void> {
        const event = await this.ctx.db.get(eventId as Id<"events">)
        if (event) {
            const { host, events } = await sharedMatchMembers(this.ctx, event)
            if (events.length > 1) {
                const roster = await this.ctx.db
                    .query("rosters")
                    .withIndex("eventId", (q) => q.eq("eventId", host._id))
                    .unique()
                if (!roster) return
                if (
                    roster.squads.some((squad) =>
                        squad.players.some(
                            (slot) => slot.id === userId && slot.locked
                        )
                    )
                )
                    return
                const { assignments, owners } = await sharedMatchPeople(
                    this.ctx,
                    events
                )
                const next = syncRosterMembershipForUser(
                    roster,
                    {
                        ...host,
                        participants: events.flatMap((local) =>
                            (local.participants ?? []).filter(
                                (person) =>
                                    owners.get(person.userId) === local.guildId
                            )
                        ),
                        signUps: events.flatMap((local) =>
                            (local.signUps ?? []).filter(
                                (person) =>
                                    owners.get(person.userId) === local.guildId
                            )
                        ),
                    },
                    assignments.map((item) => ({
                        ...item,
                        serverId: host.guildId,
                    })),
                    userId,
                    systemClock.now()
                )
                await this.ctx.db.patch(roster._id, {
                    squads: next.squads,
                    reservePlayerIds: next.reservePlayerIds,
                    reserveAttendances: next.reserveAttendances,
                    notAttendingPlayerIds: next.notAttendingPlayerIds,
                    updatedAt: rosterRevisionTimestamp(
                        roster.updatedAt,
                        new Date()
                    ),
                })
                return
            }
        }
        const useCase = new SyncRosterMembershipForUserUseCase(
            new ConvexEventRepository(this.ctx),
            new ConvexRosterRepository(this.ctx),
            new ConvexAssignmentRepository(this.ctx),
            systemClock
        )
        await useCase.execute(eventId, userId)
    }
}
