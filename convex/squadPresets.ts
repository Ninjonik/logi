import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { getGuildById, getGuildDiscordId } from "./identity";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

const squadRole = v.object({
  name: v.string(),
  color: v.string(),
  icon: v.string(),
  count: v.number(),
  note: v.optional(v.string()),
});

const squadPresetSquad = v.object({
  name: v.string(),
  group: v.string(),
  order: v.number(),
  color: v.string(),
  icon: v.string(),
  roles: v.array(squadRole),
});

export const upsert = mutation({
  args: {
    secret: v.string(),
    serverId: v.id("guilds"),
    presetId: v.optional(v.id("squadPresets")),
    name: v.string(),
    squads: v.array(squadPresetSquad),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const guild = await getGuildById(ctx, args.serverId);
    if (!guild) {
      throw new Error("Server not found.");
    }
    const guildDiscordId = getGuildDiscordId(guild);

    const name = args.name.trim();
    if (!name) {
      throw new Error("Preset name is required.");
    }

    const squads = args.squads
      .map((squad, index) => ({
        name: squad.name.trim(),
        group: squad.group.trim(),
        order: index,
        color: squad.color.trim(),
        icon: squad.icon.trim(),
        roles: squad.roles.map((role) => ({
          name: role.name.trim(),
          color: role.color.trim(),
          icon: role.icon.trim(),
          count: Math.max(1, Math.trunc(role.count)),
          note: role.note?.trim() || undefined,
        })),
      }))
      .filter((squad) => squad.name && squad.group);

    if (!squads.length) {
      throw new Error("Add at least one squad.");
    }

    if (squads.some((squad) => !squad.roles.length || squad.roles.some((role) => !role.name))) {
      throw new Error("Every squad needs at least one named role.");
    }

    const payload = {
      guildId: guildDiscordId,
      name,
      squads,
      updatedAt: new Date().toISOString(),
    };

    if (args.presetId) {
      const existing = await ctx.db.get(args.presetId);
      if (!existing || existing.guildId !== guildDiscordId) {
        throw new Error("Squad preset not found.");
      }

      await ctx.db.patch(args.presetId, payload);
      return String(args.presetId);
    }

    const now = new Date().toISOString();
    const presetId = await ctx.db.insert("squadPresets", {
      ...payload,
      createdAt: now,
      updatedAt: now,
    });

    return String(presetId);
  },
});
