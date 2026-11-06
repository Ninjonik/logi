import {
    matchesGameScope,
    resolveGameScope,
    type GameId,
} from "@/domain/games/game"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"

import type { RosterCommandRepository } from "@/application/rosters/roster-commands.use-case"
import type { RosterCommandRecord } from "@/application/rosters/roster-commands.use-case"
import type { RosterManagementRepository } from "@/application/rosters/manage-roster"
import { rosterRevisionTimestamp } from "../../domain/rosters/shared-roster"
import { sharedMatchMembers, sharedMatchPeople } from "./shared-match-store"
import { rosterCardHome } from "@/domain/rosters/roster-update-channel"
import { saveSharedRoster } from "./shared-roster-command"
import { withGameOverrides } from "@/domain/games/game"

export class ConvexRosterCommandRepository
    implements RosterCommandRepository, RosterManagementRepository
{
    constructor(private readonly ctx: MutationCtx) {}

    async saveShared(
        input: Parameters<
            NonNullable<RosterManagementRepository["saveShared"]>
        >[0]
    ) {
        return saveSharedRoster(this.ctx, this, input)
    }

    async getRosterById(rosterId: string) {
        const roster = await this.ctx.db.get(rosterId as Id<"rosters">)
        return roster ? { id: String(roster._id), ...roster } : null
    }

    async getRosterByEventId(eventId: string) {
        const roster = await this.ctx.db
            .query("rosters")
            .withIndex("eventId", (q) =>
                q.eq("eventId", eventId as Id<"events">)
            )
            .unique()
        return roster ? { id: String(roster._id), ...roster } : null
    }

    async getEvent(eventId: string) {
        const event = await this.ctx.db.get(eventId as Id<"events">)
        if (!event) return null
        if (event.hostEventId) return { ...event }
        const { events } = await sharedMatchMembers(this.ctx, event)
        if (events.length === 1) return { ...event }
        const { owners } = await sharedMatchPeople(this.ctx, events)
        return {
            ...event,
            participants: events.flatMap((item) =>
                (item.participants ?? []).filter(
                    (person) => owners.get(person.userId) === item.guildId
                )
            ),
            signUps: events.flatMap((item) =>
                (item.signUps ?? []).filter(
                    (person) => owners.get(person.userId) === item.guildId
                )
            ),
        }
    }

    async listAssignments(serverDiscordId: string, gameId?: GameId) {
        const assignments = await this.ctx.db
            .query("userAssignments")
            .withIndex("serverId", (q) => q.eq("serverId", serverDiscordId))
            .collect()
        return assignments.filter((assignment) =>
            matchesGameScope(assignment.gameId, resolveGameScope(gameId))
        )
    }

    async createRoster(roster: Omit<RosterCommandRecord, "id">) {
        const now = new Date().toISOString()
        const event = await this.getEvent(roster.eventId)
        if (!event) throw new Error("Event not found.")
        const id = await this.ctx.db.insert("rosters", {
            ...roster,
            eventId: roster.eventId as Id<"events">,
            squadPresetId: roster.squadPresetId as
                Id<"squadPresets"> | undefined,
            guildId: event.guildId,
            gameId: event.gameId,
            createdAt: now,
            updatedAt: now,
        })
        return String(id)
    }

    async updateRoster(
        rosterId: string,
        roster: Omit<RosterCommandRecord, "id">
    ) {
        const event = await this.getEvent(roster.eventId)
        if (!event) throw new Error("Event not found.")
        const savedRoster = await this.ctx.db.get(rosterId as Id<"rosters">)
        const updatedAt = rosterRevisionTimestamp(
            savedRoster?.updatedAt,
            new Date()
        )
        if (event.hostEventId) {
            const previous = await this.ctx.db.get(rosterId as Id<"rosters">)
            const host = await this.ctx.db.get(event.hostEventId)
            if (!previous || !host) throw new Error("Roster not found.")
            const { events } = await sharedMatchMembers(this.ctx, {
                ...event,
                _id: roster.eventId as Id<"events">,
            })
            const { owners } = await sharedMatchPeople(this.ctx, events)
            const canonical = await this.ctx.db
                .query("rosters")
                .withIndex("eventId", (q) => q.eq("eventId", host._id))
                .unique()
            if (!canonical) throw new Error("Roster not found.")
            const attendance = new Map(
                roster.squads.flatMap((squad) =>
                    squad.players.flatMap((slot) =>
                        slot.id && owners.get(slot.id) === event.guildId
                            ? [[slot.id, slot] as const]
                            : []
                    )
                )
            )
            await this.ctx.db.patch(canonical._id, {
                squads: canonical.squads.map((squad) => ({
                    ...squad,
                    players: squad.players.map((slot) => {
                        const next = slot.id ? attendance.get(slot.id) : null
                        return next
                            ? {
                                  ...slot,
                                  ack: next.ack,
                                  confirmed: next.confirmed,
                              }
                            : slot
                    }),
                })),
                reserveAttendances: [
                    ...(canonical.reserveAttendances ?? []).filter(
                        (item) => owners.get(item.userId) !== event.guildId
                    ),
                    ...(roster.reserveAttendances ?? []).filter(
                        (item) => owners.get(item.userId) === event.guildId
                    ),
                ],
                updatedAt: rosterRevisionTimestamp(
                    canonical.updatedAt,
                    new Date()
                ),
            })
            return
        }
        await this.ctx.db.patch(rosterId as Id<"rosters">, {
            ...roster,
            eventId: roster.eventId as Id<"events">,
            squadPresetId: roster.squadPresetId as
                Id<"squadPresets"> | undefined,
            guildId: event.guildId,
            gameId: event.gameId,
            updatedAt,
        })
    }

    async getPreset(id: string) {
        return this.ctx.db.get(id as Id<"squadPresets">)
    }
    async delete(id: string) {
        const roster = await this.ctx.db.get(id as Id<"rosters">)
        const event = roster ? await this.ctx.db.get(roster.eventId) : null
        if (event && !event.hostEventId) {
            const { events } = await sharedMatchMembers(this.ctx, event)
            for (const local of events.slice(1)) {
                const copy = await this.ctx.db
                    .query("rosters")
                    .withIndex("eventId", (q) => q.eq("eventId", local._id))
                    .unique()
                if (copy) await this.ctx.db.delete(copy._id)
            }
        }
        await this.ctx.db.delete(id as Id<"rosters">)
    }
    async publish(input: Parameters<RosterManagementRepository["publish"]>[0]) {
        const rosterId = input.rosterId as Id<"rosters">
        await this.ctx.db.patch(rosterId, {
            publishedAt: input.publishedAt,
            ...(input.choice
                ? {
                      discordMessageVariant: input.choice.variant,
                      discordMentionPlayers: input.choice.mentionPlayers,
                  }
                : {}),
        })
        if (
            !input.firstPublish ||
            !input.choice?.mentionPlayers ||
            !input.requestedBy
        )
            return
        const event = await this.ctx.db.get(input.eventId as Id<"events">)
        if (!event) throw new Error("Event not found.")
        const config = await this.ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", input.guildId))
            .unique()
        const channels = config
            ? withGameOverrides(config, config.gameOverrides, event.gameId)
            : null
        if (
            rosterCardHome({
                kind: event.kind ?? "match",
                eventAnnouncementChannelId: event.announcementChannelId,
                eventInfoChannelId: event.eventInfoChannelId,
                configuredAnnouncementChannelId:
                    channels?.announcementsChannelId,
                configuredEventInfoChannelId: channels?.eventInfoChannelId,
            }) === "announcement"
        )
            await this.ctx.db.insert("rosterChangeRequests", {
                guildId: input.guildId,
                eventId: event._id,
                rosterId,
                requestedBy: input.requestedBy,
                requestedAt: input.publishedAt,
                before: [],
                notifyPlayers: false,
                postDigest: false,
                mentionPlayers: true,
                rosterPublishedAt: input.publishedAt,
                firstPublish: true,
                status: "pending",
            })
    }
}
