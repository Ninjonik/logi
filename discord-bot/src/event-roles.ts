import type { Guild } from "discord.js"

import { reportClanDiscordError } from "./error-reporting"
import type { EventRecord, Roster } from "./types"
import { convex, references } from "./convex"
import { env } from "./environment"

/** Role names in the clan language: "VLK vs ROG · Hráči", "… · Zálohy" (L1-145). */
export type EventRoleNames = { players: string; reserves: string }

export async function syncEventRoles(
    guild: Guild,
    event: EventRecord,
    roster: Roster | null,
    names: EventRoleNames
) {
    let attendeeRoleId = event.attendeeRoleId
    let reserveRoleId = event.reserveRoleId
    try {
        // A match created with participant roles turned off never gets them;
        // any left over are removed the same way as after the match.
        if (
            event.status === "concluded" ||
            event.createParticipantRoles === false
        ) {
            await Promise.all(
                [attendeeRoleId, reserveRoleId]
                    .filter((id): id is string => Boolean(id))
                    .map(async (id) =>
                        (await guild.roles.fetch(id).catch(() => null))
                            ?.delete(`Event concluded: ${event.name}`)
                            .catch(() => null)
                    )
            )
            if (attendeeRoleId || reserveRoleId)
                await convex.mutation(references.setDiscordEventRoles, {
                    secret: env.internalSecret,
                    eventId: event.id as never,
                })
            return { attendeeRoleId: undefined, reserveRoleId: undefined }
        }
        const existingAttendee = attendeeRoleId
            ? await guild.roles.fetch(attendeeRoleId).catch(() => null)
            : null
        if (!existingAttendee)
            attendeeRoleId = (
                await guild.roles.create({
                    name: names.players,
                    reason: `Event attendees for ${event.name}`,
                })
            ).id
        else if (existingAttendee.name !== names.players)
            // Roles made before the clan-language names, or after a rename.
            await existingAttendee
                .setName(names.players, "Match role name")
                .catch(() => null)
        const existingReserve = reserveRoleId
            ? await guild.roles.fetch(reserveRoleId).catch(() => null)
            : null
        if (!existingReserve)
            reserveRoleId = (
                await guild.roles.create({
                    name: names.reserves,
                    reason: `Event reserves for ${event.name}`,
                })
            ).id
        else if (existingReserve.name !== names.reserves)
            await existingReserve
                .setName(names.reserves, "Match role name")
                .catch(() => null)
        if (
            attendeeRoleId !== event.attendeeRoleId ||
            reserveRoleId !== event.reserveRoleId
        )
            await convex.mutation(references.setDiscordEventRoles, {
                secret: env.internalSecret,
                eventId: event.id as never,
                attendeeRoleId,
                reserveRoleId,
            })
        const reserveIds = new Set(roster?.reservePlayerIds ?? [])
        const attendeeIds = new Set(
            event.participants
                .filter((entry) => entry.status === "attending")
                .map((entry) => entry.userId)
        )
        const rosteredIds: string[] =
            roster?.squads.flatMap((squad) =>
                squad.players
                    .map((player) => player.id)
                    .filter((id): id is string => Boolean(id))
            ) ?? []
        for (const id of rosteredIds) attendeeIds.add(id)
        for (const id of reserveIds) attendeeIds.delete(id)
        const attendeeRole = await guild.roles
            .fetch(attendeeRoleId!)
            .catch(() => null)
        const reserveRole = await guild.roles
            .fetch(reserveRoleId!)
            .catch(() => null)
        const relevantMemberIds = new Set([
            ...attendeeIds,
            ...reserveIds,
            ...(attendeeRole ? attendeeRole.members.keys() : []),
            ...(reserveRole ? reserveRole.members.keys() : []),
        ])
        const members = await guild.members
            .fetch({ user: [...relevantMemberIds] })
            .catch(() => null)
        if (members) {
            const roleUpdates = [...members.values()].flatMap((member) => {
                const updates: Promise<unknown>[] = []
                const hasAttendeeRole = member.roles.cache.has(attendeeRoleId!)
                const hasReserveRole = member.roles.cache.has(reserveRoleId!)
                if (attendeeIds.has(member.id) !== hasAttendeeRole) {
                    updates.push(
                        (attendeeIds.has(member.id)
                            ? member.roles.add(attendeeRoleId!)
                            : member.roles.remove(attendeeRoleId!)
                        ).catch(() => null)
                    )
                }
                if (reserveIds.has(member.id) !== hasReserveRole) {
                    updates.push(
                        (reserveIds.has(member.id)
                            ? member.roles.add(reserveRoleId!)
                            : member.roles.remove(reserveRoleId!)
                        ).catch(() => null)
                    )
                }
                return updates
            })
            await Promise.all(roleUpdates)
        }
    } catch (error) {
        void reportClanDiscordError({
            client: guild.client,
            guildId: guild.id,
            error,
            action: `Sync event roles for "${event.name}"`,
            location: "Event roles",
            scope: "event-roles",
            target: event.name,
            details: { eventId: event.id },
        })
    }
    return { attendeeRoleId, reserveRoleId }
}
