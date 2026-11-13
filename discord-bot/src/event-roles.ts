import { missingDiscordResource } from "./runtime/discord-resource"
import { mapConcurrent } from "./runtime/work-queue"
import type { Guild } from "discord.js"

import { isAdminFixableFailure } from "../../src/domain/discord-messages/bot-errors"
import { matchTitle } from "../../src/domain/discord-messages/match-text"
import { fillTemplate } from "../../src/domain/discord-messages/format"
import { getRosterMessages } from "../../src/lib/clan-language/rosters"
import { errorFacts, reportClanDiscordError } from "./error-reporting"
import type { EventRecord, Roster } from "./types"
import { convex, references } from "./convex"
import { env } from "./environment"

/**
 * The match roles "VLK vs ROG · Hráči" and "VLK vs ROG · Zálohy", named
 * after the match title with the suffix in the clan language (L1-145).
 */
export function eventRoleName(
    event: Pick<EventRecord, "name" | "matchTeams">,
    kind: "players" | "reserves",
    language?: string
) {
    return fillTemplate(getRosterMessages(language).roles[kind], {
        match: matchTitle(event),
    }).slice(0, 100)
}

/**
 * Creates, renames and hands out the match's player and reserve roles. A
 * failure goes to the errors channel with the match and the role it was
 * about, so a role above the Logi role or a deleted one is named (L5-19).
 */
export async function syncEventRoles(
    guild: Guild,
    event: EventRecord,
    roster: Roster | null,
    language?: string,
    report: typeof reportClanDiscordError = reportClanDiscordError
) {
    let attendeeRoleId = event.attendeeRoleId
    let reserveRoleId = event.reserveRoleId
    const reportFailure = (error: unknown, roleId: string | undefined) =>
        void report({
            client: guild.client,
            guildId: guild.id,
            error,
            source: "eventRoles",
            eventId: event.id,
            roleId,
        })
    try {
        // A match created with participant roles turned off never gets them;
        // any left over are removed the same way as after the match.
        if (
            event.status === "concluded" ||
            event.createParticipantRoles === false
        ) {
            // Failed cleanup must retain the bindings for a later retry.
            for (const id of [attendeeRoleId, reserveRoleId]) {
                if (!id) continue
                const role = await guild.roles
                    .fetch(id)
                    .catch(missingDiscordResource(10011))
                if (role)
                    await role
                        .delete(`Event concluded: ${event.name}`)
                        .catch(missingDiscordResource(10011))
            }
            if (attendeeRoleId || reserveRoleId)
                await convex.mutation(references.setDiscordEventRoles, {
                    secret: env.internalSecret,
                    guildId: guild.id,
                    eventId: event.id as never,
                })
            return { attendeeRoleId: undefined, reserveRoleId: undefined }
        }
        let existingAttendee = attendeeRoleId
            ? await guild.roles
                  .fetch(attendeeRoleId)
                  .catch(missingDiscordResource(10011))
            : null
        if (!existingAttendee) {
            existingAttendee = await guild.roles.create({
                name: eventRoleName(event, "players", language),
                reason: `Event attendees for ${event.name}`,
            })
            attendeeRoleId = existingAttendee.id
            // Persist a successful provision before attempting the next role.
            await convex.mutation(references.setDiscordEventRoles, {
                secret: env.internalSecret,
                guildId: guild.id,
                eventId: event.id as never,
                attendeeRoleId,
                reserveRoleId,
            })
        }
        let existingReserve = reserveRoleId
            ? await guild.roles
                  .fetch(reserveRoleId)
                  .catch(missingDiscordResource(10011))
            : null
        if (!existingReserve) {
            existingReserve = await guild.roles.create({
                name: eventRoleName(event, "reserves", language),
                reason: `Event reserves for ${event.name}`,
            })
            reserveRoleId = existingReserve.id
        }
        if (
            attendeeRoleId !== event.attendeeRoleId ||
            reserveRoleId !== event.reserveRoleId
        )
            await convex.mutation(references.setDiscordEventRoles, {
                secret: env.internalSecret,
                guildId: guild.id,
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
        for (const id of rosteredIds)
            if (
                roster?.localPlayerIds === undefined ||
                roster.localPlayerIds.includes(id)
            )
                attendeeIds.add(id)
        for (const id of reserveIds) attendeeIds.delete(id)
        const attendeeRole = existingAttendee
        const reserveRole = existingReserve
        // Roles created before the redesign, or before the match was
        // renamed, get the current clan-language names.
        for (const [role, kind] of [
            [attendeeRole, "players"],
            [reserveRole, "reserves"],
        ] as const) {
            const name = eventRoleName(event, kind, language)
            if (role && role.name !== name) await role.setName(name)
        }
        const relevantMemberIds = new Set([
            ...attendeeIds,
            ...reserveIds,
            ...(attendeeRole ? attendeeRole.members.keys() : []),
            ...(reserveRole ? reserveRole.members.keys() : []),
        ])
        if (!relevantMemberIds.size) return { attendeeRoleId, reserveRoleId }
        const members = await guild.members.fetch({
            user: [...relevantMemberIds],
        })
        if (members) {
            // One member's refused change never stops the others; the first
            // refusal an admin must fix (a role above the Logi role, a
            // deleted role, a missing permission) is reported once per role.
            const refused = new Map<string, unknown>()
            const change = (roleId: string, update: () => Promise<unknown>) =>
                update().catch((error: unknown) => {
                    if (
                        !refused.has(roleId) &&
                        isAdminFixableFailure(errorFacts(error).facts.failure)
                    )
                        refused.set(roleId, error)
                })
            await mapConcurrent([...members.values()], 4, async (member) => {
                const updates: Array<() => Promise<unknown>> = []
                const hasAttendeeRole = member.roles.cache.has(attendeeRoleId!)
                const hasReserveRole = member.roles.cache.has(reserveRoleId!)
                if (attendeeIds.has(member.id) !== hasAttendeeRole) {
                    updates.push(() =>
                        change(attendeeRoleId!, () =>
                            attendeeIds.has(member.id)
                                ? member.roles.add(attendeeRoleId!)
                                : member.roles.remove(attendeeRoleId!)
                        )
                    )
                }
                if (reserveIds.has(member.id) !== hasReserveRole) {
                    updates.push(() =>
                        change(reserveRoleId!, () =>
                            reserveIds.has(member.id)
                                ? member.roles.add(reserveRoleId!)
                                : member.roles.remove(reserveRoleId!)
                        )
                    )
                }
                for (const update of updates) await update()
            })
            for (const [roleId, error] of refused) reportFailure(error, roleId)
        }
    } catch (error) {
        // Creating a role needs Manage Roles on the server; no role yet.
        reportFailure(error, undefined)
    }
    return { attendeeRoleId, reserveRoleId }
}
