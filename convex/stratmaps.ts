import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";

import { canAccessServerContext, canAdminServerContext, normalizeDoc, normalizeStratmapDoc } from "../src/infrastructure/convex/server-read-model";
import { getGuildByDiscordId, getGuildDiscordId, getGuildById, getUserByDiscordId } from "./identity";
import { buildDefaultStratmapState, stringifyStratmapState } from "../src/lib/stratmaps";

async function resolveGuildAccess(ctx: QueryCtx | MutationCtx, input: {
  userId: string;
  guildDiscordId: string;
}) {
  const [user, guild] = await Promise.all([
    getUserByDiscordId(ctx, input.userId),
    getGuildByDiscordId(ctx, input.guildDiscordId),
  ]);

  if (!user || !guild) {
    return null;
  }

  const discordAccess = await ctx.db
    .query("discordMemberAccess")
    .withIndex("guildId_userId", (q) => q.eq("guildId", input.guildDiscordId).eq("userId", input.userId))
    .unique();

  if (!canAccessServerContext({ user, serverDiscordId: input.guildDiscordId, discordAccess })) {
    return null;
  }

  return {
    guild,
    canAdmin: canAdminServerContext({
      serverAdminIds: guild.adminIds,
      userId: input.userId,
      discordAccess,
    }),
  };
}

export const listByGuild = query({
  args: {
    userId: v.string(),
    serverId: v.id("guilds"),
  },
  handler: async (ctx, args) => {
    const guild = await getGuildById(ctx, String(args.serverId));
    if (!guild) {
      return null;
    }

    const guildDiscordId = getGuildDiscordId(guild);
    const access = await resolveGuildAccess(ctx, {
      userId: args.userId,
      guildDiscordId,
    });

    if (!access) {
      return null;
    }

    const stratmaps = await ctx.db
      .query("stratmaps")
      .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
      .collect();

    return {
      canAdmin: access.canAdmin,
      stratmaps: stratmaps.map(normalizeStratmapDoc),
    };
  },
});

export const getById = query({
  args: {
    userId: v.string(),
    stratmapId: v.id("stratmaps"),
  },
  handler: async (ctx, args) => {
    const stratmap = await ctx.db.get(args.stratmapId);
    if (!stratmap) {
      return null;
    }

    const access = await resolveGuildAccess(ctx, {
      userId: args.userId,
      guildDiscordId: stratmap.guildId,
    });

    if (!access) {
      return null;
    }

    return {
      canAdmin: access.canAdmin,
      serverId: String(access.guild._id),
      stratmap: normalizeStratmapDoc(stratmap),
    };
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    serverId: v.id("guilds"),
    title: v.string(),
    description: v.optional(v.string()),
    baseMapId: v.string(),
    side: v.optional(v.string()),
    strongpointId: v.optional(v.string()),
    eventId: v.optional(v.id("events")),
  },
  handler: async (ctx, args) => {
    const guild = await getGuildById(ctx, String(args.serverId));
    if (!guild) {
      throw new Error("Server not found.");
    }

    const guildDiscordId = getGuildDiscordId(guild);
    const access = await resolveGuildAccess(ctx, {
      userId: args.userId,
      guildDiscordId,
    });

    if (!access?.canAdmin) {
      throw new Error("Only admins can create stratmaps.");
    }

    const now = new Date().toISOString();
    const stratmapId = await ctx.db.insert("stratmaps", {
      guildId: guildDiscordId,
      eventId: args.eventId,
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      baseMapId: args.baseMapId,
      side: args.side?.trim() || undefined,
      strongpointId: args.strongpointId?.trim() || undefined,
      state: stringifyStratmapState(buildDefaultStratmapState(args.baseMapId)),
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    return String(stratmapId);
  },
});

export const updateMeta = mutation({
  args: {
    userId: v.string(),
    stratmapId: v.id("stratmaps"),
    title: v.string(),
    description: v.optional(v.string()),
    baseMapId: v.string(),
    side: v.optional(v.string()),
    strongpointId: v.optional(v.string()),
    eventId: v.optional(v.id("events")),
  },
  handler: async (ctx, args) => {
    const stratmap = await ctx.db.get(args.stratmapId);
    if (!stratmap) {
      throw new Error("Stratmap not found.");
    }

    const access = await resolveGuildAccess(ctx, {
      userId: args.userId,
      guildDiscordId: stratmap.guildId,
    });

    if (!access?.canAdmin) {
      throw new Error("Only admins can edit stratmaps.");
    }

    await ctx.db.patch(args.stratmapId, {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      baseMapId: args.baseMapId,
      side: args.side?.trim() || undefined,
      strongpointId: args.strongpointId?.trim() || undefined,
      eventId: args.eventId,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const updateState = mutation({
  args: {
    userId: v.string(),
    stratmapId: v.id("stratmaps"),
    state: v.string(),
  },
  handler: async (ctx, args) => {
    const stratmap = await ctx.db.get(args.stratmapId);
    if (!stratmap) {
      throw new Error("Stratmap not found.");
    }

    const access = await resolveGuildAccess(ctx, {
      userId: args.userId,
      guildDiscordId: stratmap.guildId,
    });

    if (!access?.canAdmin) {
      throw new Error("Only admins can edit stratmaps.");
    }

    await ctx.db.patch(args.stratmapId, {
      state: args.state,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const ping = mutation({
  args: {
    userId: v.string(),
    stratmapId: v.id("stratmaps"),
    state: v.string(),
  },
  handler: async (ctx, args) => {
    const stratmap = await ctx.db.get(args.stratmapId);
    if (!stratmap) {
      throw new Error("Stratmap not found.");
    }

    const access = await resolveGuildAccess(ctx, {
      userId: args.userId,
      guildDiscordId: stratmap.guildId,
    });

    if (!access?.canAdmin) {
      throw new Error("Only admins can ping the map.");
    }

    await ctx.db.patch(args.stratmapId, {
      state: args.state,
      updatedAt: new Date().toISOString(),
    });
  },
});
