import {
    assertGuestRosterEdit,
    assertUniqueRosterPlayers,
} from "../../domain/rosters/shared-roster"
import type { RosterManagementRepository } from "../../application/rosters/manage-roster"
import { UpsertRosterUseCase } from "../../application/rosters/roster-commands.use-case"
import { sharedMatchMembers, sharedMatchPeople } from "./shared-match-store"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"
import { resolveGameScope } from "../../domain/games/game"

export async function saveSharedRoster(
    ctx: MutationCtx,
    repository: RosterManagementRepository,
    input: Parameters<NonNullable<RosterManagementRepository["saveShared"]>>[0]
) {
    const event = await ctx.db.get(input.eventId as Id<"events">)
    if (!event || event.guildId !== input.guildId)
        throw new Error("Event not found.")
    const { host, events } = await sharedMatchMembers(ctx, event)
    if (events.length === 1 && !event.hostEventId) return null
    const local = await ctx.db
        .query("rosters")
        .withIndex("eventId", (q) => q.eq("eventId", event._id))
        .unique()
    const canonical = await ctx.db
        .query("rosters")
        .withIndex("eventId", (q) => q.eq("eventId", host._id))
        .unique()
    if (input.rosterId && local?._id !== input.rosterId)
        throw new Error("Roster not found.")
    if (local && input.expectedUpdatedAt !== local.updatedAt)
        throw new Error(
            "The roster changed. Reload it before saving your changes."
        )
    const { owners, eligibleByGuild } = await sharedMatchPeople(ctx, events)
    const eligible = eligibleByGuild.get(event.guildId) ?? new Set<string>()
    const guest = Boolean(event.hostEventId)
    if (!guest && input.squadPresetId) {
        const preset = await repository.getPreset(input.squadPresetId)
        if (
            !preset ||
            preset.guildId !== host.guildId ||
            resolveGameScope(preset.gameId) !== resolveGameScope(host.gameId)
        )
            throw new Error(
                "Squad preset does not belong to this clan and game."
            )
    }
    if (guest) {
        if (!local || !canonical)
            throw new Error("The host has not created a roster yet.")
        assertGuestRosterEdit({
            hostGuildId: host.guildId,
            actorGuildId: event.guildId,
            before: local,
            after: input,
            eligibleUserIds: eligible,
        })
    }
    const savedAssignments = new Set(
        (canonical?.squads ?? []).flatMap((squad) =>
            squad.players
                .filter((slot) => slot.id)
                .map((slot) => JSON.stringify([slot.id, slot.allocatedGuildId]))
        )
    )
    for (const squad of input.squads)
        for (const slot of squad.players) {
            const unchanged =
                slot.id &&
                savedAssignments.has(
                    JSON.stringify([slot.id, slot.allocatedGuildId])
                )
            if (slot.id && !unchanged && !owners.has(slot.id))
                throw new Error("Choose a player from a participating clan.")
            if (
                slot.allocatedGuildId &&
                !events.some((item) => item.guildId === slot.allocatedGuildId)
            )
                throw new Error(
                    "Slot allocation must name a participating clan."
                )
            if (
                slot.id &&
                !unchanged &&
                slot.allocatedGuildId &&
                !eligibleByGuild.get(slot.allocatedGuildId)?.has(slot.id)
            )
                throw new Error(
                    "The selected player does not belong to the allocated clan."
                )
        }
    const localIds = eligible
    const payload =
        guest && canonical
            ? {
                  ...input,
                  rosterId: String(canonical._id),
                  eventId: String(host._id),
                  squadPresetId: canonical.squadPresetId,
                  streamerId: canonical.streamerId,
                  reservePlayerIds: [
                      ...canonical.reservePlayerIds.filter(
                          (id) => !localIds.has(id)
                      ),
                      ...input.reservePlayerIds,
                  ],
                  reserveAttendances: [
                      ...(canonical.reserveAttendances ?? []).filter(
                          (item) => !localIds.has(item.userId)
                      ),
                      ...(input.reserveAttendances ?? []),
                  ],
                  notAttendingPlayerIds: [
                      ...canonical.notAttendingPlayerIds.filter(
                          (id) => !localIds.has(id)
                      ),
                      ...input.notAttendingPlayerIds,
                  ],
              }
            : { ...input }
    if (!guest)
        payload.squads = payload.squads.map((squad) => ({
            ...squad,
            players: squad.players.map((slot) => {
                const owner = slot.id ? owners.get(slot.id) : undefined
                return !slot.allocatedGuildId && owner && owner !== host.guildId
                    ? { ...slot, allocatedGuildId: owner }
                    : slot
            }),
        }))
    // Reallocating a filled place returns the displaced person to their reserves.
    const placed = new Set(
        payload.squads.flatMap((squad) =>
            squad.players.flatMap((slot) => (slot.id ? [slot.id] : []))
        )
    )
    for (const squad of canonical?.squads ?? [])
        for (const slot of squad.players)
            if (
                slot.id &&
                !placed.has(slot.id) &&
                !payload.notAttendingPlayerIds.includes(slot.id) &&
                !payload.reservePlayerIds.includes(slot.id)
            )
                payload.reservePlayerIds.push(slot.id)
    assertUniqueRosterPlayers(payload)
    // Picking a mercenary's clan representation moves only this match's signup,
    // never their independent membership or assignment records.
    for (const squad of payload.squads)
        for (const slot of squad.players) {
            if (!slot.id) continue
            const targetGuild = slot.allocatedGuildId ?? host.guildId
            const target = events.find((item) => item.guildId === targetGuild)
            if (!target) continue
            const source = events.find(
                (item) =>
                    item._id !== target._id &&
                    item.participants?.some(
                        (person) => person.userId === slot.id
                    )
            )
            if (!source) continue
            const currentSource = await ctx.db.get(source._id)
            const currentTarget = await ctx.db.get(target._id)
            const participant = currentSource?.participants?.find(
                (person) => person.userId === slot.id
            )
            if (!participant || !currentTarget) continue
            const updatedAt = new Date().toISOString()
            await ctx.db.patch(source._id, {
                participants: (currentSource?.participants ?? []).filter(
                    (person) => person.userId !== slot.id
                ),
                signUps: (currentSource?.signUps ?? []).filter(
                    (person) => person.userId !== slot.id
                ),
                updatedAt,
            })
            if (
                !currentTarget.participants?.some(
                    (person) => person.userId === slot.id
                )
            )
                await ctx.db.patch(target._id, {
                    participants: [
                        ...(currentTarget.participants ?? []),
                        {
                            ...participant,
                            group: null,
                            requestedGroup: undefined,
                            updatedAt,
                        },
                    ],
                    signUps: [
                        ...(currentTarget.signUps ?? []),
                        ...(participant.status === "attending"
                            ? [{ userId: slot.id, group: null }]
                            : []),
                    ],
                    updatedAt,
                })
        }
    const { requestedBy, discordPublish } = payload
    const rosterId = await new UpsertRosterUseCase(repository).execute(payload)
    if (!guest && input.published)
        await repository.publish({
            rosterId,
            eventId: String(host._id),
            guildId: host.guildId,
            publishedAt: new Date().toISOString(),
            firstPublish: !canonical?.published,
            requestedBy,
            choice: discordPublish,
        })
    return guest ? String(local!._id) : rosterId
}
