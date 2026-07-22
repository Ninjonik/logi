import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getGuildById, getGuildDiscordId } from "./identity";
import {
  assertInternalSecret,
  membershipSettingsValidator,
  normalizeConfigDoc,
  ticketSettingsValidator,
} from "./discord-shared";

export const getConfigByGuild = query({
  args: {
    guildId: v.id("guilds"),
  },
  handler: async (ctx, args) => {
    const guild = await getGuildById(ctx, args.guildId);
    if (!guild) {
      return null;
    }
    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", getGuildDiscordId(guild)))
      .unique();

    return config ? normalizeConfigDoc(config) : null;
  },
});

export const getConfigByDiscordGuildId = query({
  args: {
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    return config ? normalizeConfigDoc(config) : null;
  },
});

export const upsertConfig = mutation({
  args: {
    secret: v.string(),
    guildId: v.id("guilds"),
    timezone: v.string(),
    defaultLanguage: v.union(v.literal("en"), v.literal("cs")),
    announcementsChannelId: v.optional(v.string()),
    forumCategoryId: v.optional(v.string()),
    meetingChannelId: v.optional(v.string()),
    clanRoleId: v.optional(v.string()),
    dashboardAdminRoleId: v.optional(v.string()),
    ticketSettings: v.optional(ticketSettingsValidator),
    membershipSettings: v.optional(membershipSettingsValidator),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const guild = await getGuildById(ctx, args.guildId);
    if (!guild) {
      throw new Error("Server not found.");
    }
    const guildDiscordId = getGuildDiscordId(guild);

    const now = new Date().toISOString();
    const payload = {
      timezone: args.timezone,
      defaultLanguage: args.defaultLanguage,
      announcementsChannelId: args.announcementsChannelId?.trim() || undefined,
      forumCategoryId: args.forumCategoryId?.trim() || undefined,
      meetingChannelId: args.meetingChannelId?.trim() || undefined,
      clanRoleId: args.clanRoleId?.trim() || undefined,
      dashboardAdminRoleId: args.dashboardAdminRoleId?.trim() || undefined,
      ticketSettings: args.ticketSettings,
      membershipSettings: args.membershipSettings,
      updatedAt: now,
    };

    const existing = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return String(existing._id);
    }

    const configId = await ctx.db.insert("discordConfigs", {
      guildId: guildDiscordId,
      ...payload,
      createdAt: now,
    });

    return String(configId);
  },
});

export const updateTicketPanelState = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    ticketPanelMessageId: v.optional(v.string()),
    ticketPanelLastConfigUpdatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!config) {
      throw new Error("Discord config not found.");
    }

    await ctx.db.patch(config._id, {
      ticketPanelMessageId: args.ticketPanelMessageId,
      ticketPanelLastConfigUpdatedAt: args.ticketPanelLastConfigUpdatedAt,
    });

    return { ok: true };
  },
});

export const updateMembershipPanelState = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    membershipPanelMessageId: v.optional(v.string()),
    membershipPanelLastConfigUpdatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const config = await ctx.db
      .query("discordConfigs")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!config) {
      throw new Error("Discord config not found.");
    }

    await ctx.db.patch(config._id, {
      membershipPanelMessageId: args.membershipPanelMessageId,
      membershipPanelLastConfigUpdatedAt: args.membershipPanelLastConfigUpdatedAt,
    });

    return { ok: true };
  },
});

export const backfillDefaultLanguages = mutation({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const now = new Date().toISOString();
    const guilds = await ctx.db.query("guilds").collect();
    const configs = await ctx.db.query("discordConfigs").collect();
    const configByGuildId = new Map(configs.map((config) => [config.guildId, config]));

    let patchedCount = 0;
    let insertedCount = 0;

    for (const config of configs) {
      if (config.defaultLanguage) {
        continue;
      }

      await ctx.db.patch(config._id, {
        defaultLanguage: "en",
        updatedAt: now,
      });
      patchedCount += 1;
    }

    for (const guild of guilds) {
      if (configByGuildId.has(getGuildDiscordId(guild))) {
        continue;
      }

      await ctx.db.insert("discordConfigs", {
        guildId: getGuildDiscordId(guild),
        timezone: "UTC",
        defaultLanguage: "en",
        createdAt: now,
        updatedAt: now,
      });
      insertedCount += 1;
    }

    return { patchedCount, insertedCount };
  },
});
