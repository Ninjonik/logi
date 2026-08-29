import type { Guild } from "discord.js";

import { convex, references } from "./convex";
import { env } from "./environment";
import { reportClanDiscordError } from "./error-reporting";
import type { EventRecord, Roster } from "./types";

function roleName(event: EventRecord, kind: "Attendees" | "Reserves") { return `${event.name} — ${kind}`.slice(0, 100); }

export async function syncEventRoles(guild: Guild, event: EventRecord, roster: Roster | null) {
  let attendeeRoleId = event.attendeeRoleId;
  let reserveRoleId = event.reserveRoleId;
  try {
    if (event.status === "concluded") {
      await Promise.all([attendeeRoleId, reserveRoleId].filter((id): id is string => Boolean(id)).map(async (id) => (await guild.roles.fetch(id).catch(() => null))?.delete(`Event concluded: ${event.name}`).catch(() => null)));
      if (attendeeRoleId || reserveRoleId) await convex.mutation(references.setDiscordEventRoles, { secret: env.internalSecret, eventId: event.id as never });
      return { attendeeRoleId: undefined, reserveRoleId: undefined };
    }
    if (!attendeeRoleId || !await guild.roles.fetch(attendeeRoleId).catch(() => null)) attendeeRoleId = (await guild.roles.create({ name: roleName(event, "Attendees"), reason: `Event attendees for ${event.name}` })).id;
    if (!reserveRoleId || !await guild.roles.fetch(reserveRoleId).catch(() => null)) reserveRoleId = (await guild.roles.create({ name: roleName(event, "Reserves"), reason: `Event reserves for ${event.name}` })).id;
    if (attendeeRoleId !== event.attendeeRoleId || reserveRoleId !== event.reserveRoleId) await convex.mutation(references.setDiscordEventRoles, { secret: env.internalSecret, eventId: event.id as never, attendeeRoleId, reserveRoleId });
    const reserveIds = new Set(roster?.reservePlayerIds ?? []);
    const attendeeIds = new Set(event.participants.filter((entry) => entry.status === "attending").map((entry) => entry.userId));
    const rosteredIds: string[] = roster?.squads.flatMap((squad) => squad.players.map((player) => player.id).filter((id): id is string => Boolean(id))) ?? [];
    for (const id of rosteredIds) attendeeIds.add(id);
    for (const id of reserveIds) attendeeIds.delete(id);
    const attendeeRole = await guild.roles.fetch(attendeeRoleId!).catch(() => null);
    const reserveRole = await guild.roles.fetch(reserveRoleId!).catch(() => null);
    const relevantMemberIds = new Set([
      ...attendeeIds,
      ...reserveIds,
      ...(attendeeRole ? attendeeRole.members.keys() : []),
      ...(reserveRole ? reserveRole.members.keys() : []),
    ]);
    const members = await guild.members.fetch({ user: [...relevantMemberIds] }).catch(() => null);
    if (members) {
      const roleUpdates = [...members.values()].flatMap((member) => {
        const updates: Promise<unknown>[] = [];
        const hasAttendeeRole = member.roles.cache.has(attendeeRoleId!);
        const hasReserveRole = member.roles.cache.has(reserveRoleId!);
        if (attendeeIds.has(member.id) !== hasAttendeeRole) {
          updates.push((attendeeIds.has(member.id) ? member.roles.add(attendeeRoleId!) : member.roles.remove(attendeeRoleId!)).catch(() => null));
        }
        if (reserveIds.has(member.id) !== hasReserveRole) {
          updates.push((reserveIds.has(member.id) ? member.roles.add(reserveRoleId!) : member.roles.remove(reserveRoleId!)).catch(() => null));
        }
        return updates;
      });
      await Promise.all(roleUpdates);
    }
  } catch (error) {
    void reportClanDiscordError({ client: guild.client, guildId: guild.id, error, action: `Sync event roles for "${event.name}"`, location: "Event roles", scope: "event-roles", target: event.name, details: { eventId: event.id } });
  }
  return { attendeeRoleId, reserveRoleId };
}
