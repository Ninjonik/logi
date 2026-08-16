import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getGuildByDiscordId, getGuildDiscordId, getUserByDiscordId } from "./identity";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";
export const DEFAULT_ROSTER_SCORE_SETTINGS = {
  noCategory: 0,
  declined: -1,
  rosterPresent: 0,
  reservePresent: 0,
  rosterAbsent: 0,
  reserveAbsent: 0,
  excusedAbsence: 0,
} as const;

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

function normalizeRosterScoreSettings(
  settings?: {
    noCategory: number;
    declined: number;
    rosterPresent: number;
    reservePresent: number;
    rosterAbsent: number;
    reserveAbsent: number;
    excusedAbsence: number;
  },
) {
  return {
    noCategory: Number.isInteger(settings?.noCategory) ? settings?.noCategory ?? DEFAULT_ROSTER_SCORE_SETTINGS.noCategory : DEFAULT_ROSTER_SCORE_SETTINGS.noCategory,
    declined: Number.isInteger(settings?.declined) ? settings?.declined ?? DEFAULT_ROSTER_SCORE_SETTINGS.declined : DEFAULT_ROSTER_SCORE_SETTINGS.declined,
    rosterPresent: Number.isInteger(settings?.rosterPresent) ? settings?.rosterPresent ?? DEFAULT_ROSTER_SCORE_SETTINGS.rosterPresent : DEFAULT_ROSTER_SCORE_SETTINGS.rosterPresent,
    reservePresent: Number.isInteger(settings?.reservePresent) ? settings?.reservePresent ?? DEFAULT_ROSTER_SCORE_SETTINGS.reservePresent : DEFAULT_ROSTER_SCORE_SETTINGS.reservePresent,
    rosterAbsent: Number.isInteger(settings?.rosterAbsent) ? settings?.rosterAbsent ?? DEFAULT_ROSTER_SCORE_SETTINGS.rosterAbsent : DEFAULT_ROSTER_SCORE_SETTINGS.rosterAbsent,
    reserveAbsent: Number.isInteger(settings?.reserveAbsent) ? settings?.reserveAbsent ?? DEFAULT_ROSTER_SCORE_SETTINGS.reserveAbsent : DEFAULT_ROSTER_SCORE_SETTINGS.reserveAbsent,
    excusedAbsence: Number.isInteger(settings?.excusedAbsence) ? settings?.excusedAbsence ?? DEFAULT_ROSTER_SCORE_SETTINGS.excusedAbsence : DEFAULT_ROSTER_SCORE_SETTINGS.excusedAbsence,
  };
}

function normalizeGuildDoc<T extends {
  _id: unknown;
}>(guild: T) {
  return {
    ...guild,
    id: String(guild._id),
    discordId: getGuildDiscordId(guild),
  };
}

export const visibleForUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByDiscordId(ctx, args.userId);

    if (!user) {
      return [];
    }

    const ids = new Set<string>();
    if (user.guildId) ids.add(user.guildId);
    for (const id of user.managedGuildIds) ids.add(id);
    for (const id of user.mercenaryGuildIds) ids.add(id);

    const discordAccess = await ctx.db
      .query("discordMemberAccess")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();
    for (const access of discordAccess) {
      if (access.hasDashboardAccess) {
        ids.add(access.guildId);
      }
    }

    const adminGuildIds = new Set<string>(user.managedGuildIds);
    for (const access of discordAccess) {
      if (access.isAdmin) {
        adminGuildIds.add(access.guildId);
      }
    }

    const guilds = (
      await Promise.all(
        [...ids].map((guildId) =>
          getGuildByDiscordId(ctx, guildId),
        ),
      )
    ).filter((guild): guild is NonNullable<typeof guild> => Boolean(guild));

    return guilds.map((guild) => ({
        ...normalizeGuildDoc(guild),
        canAdmin: guild.adminIds.includes(args.userId) || adminGuildIds.has(getGuildDiscordId(guild)),
      }));
  },
});

export const syncManagedGuilds = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    guilds: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        avatar: v.string(),
        botInside: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const user = await getUserByDiscordId(ctx, args.userId);

    if (!user) {
      throw new Error("Player not found.");
    }

    const now = new Date().toISOString();
    const managedGuildIds = args.guilds.map((guild) => guild.id);

    for (const guild of args.guilds) {
      const existing = await getGuildByDiscordId(ctx, guild.id);

      if (existing) {
        const adminIds = existing.adminIds.includes(args.userId)
          ? existing.adminIds
          : [...existing.adminIds, args.userId];

        await ctx.db.patch(existing._id, {
          name: guild.name,
          avatar: guild.avatar,
          botInside: guild.botInside,
          adminIds,
          updatedAt: now,
        });

        const existingConfig = await ctx.db
          .query("discordConfigs")
          .withIndex("guildId", (q) => q.eq("guildId", guild.id))
          .unique();
        if (!existingConfig) {
          await ctx.db.insert("discordConfigs", {
            guildId: guild.id,
            timezone: "UTC",
            defaultLanguage: "en",
            createdAt: now,
            updatedAt: now,
          });
        }
        continue;
      }

      await ctx.db.insert("guilds", {
        discordId: guild.id,
        id: guild.id,
        name: guild.name,
        avatar: guild.avatar,
        description: undefined,
        botInside: guild.botInside,
        adminIds: [args.userId],
        memberIds: [],
        members: [],
        mercenaryIds: [],
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("discordConfigs", {
        guildId: guild.id,
        timezone: "UTC",
        defaultLanguage: "en",
        createdAt: now,
        updatedAt: now,
      });
    }

    const currentGuilds = await ctx.db.query("guilds").collect();
    for (const guild of currentGuilds) {
      if (!guild.adminIds.includes(args.userId)) {
        continue;
      }

      if (managedGuildIds.includes(getGuildDiscordId(guild))) {
        continue;
      }

      await ctx.db.patch(guild._id, {
        adminIds: guild.adminIds.filter((id) => id !== args.userId),
        updatedAt: now,
      });
    }

    await ctx.db.patch(user._id, {
      managedGuildIds,
      updatedAt: now,
    });

    return managedGuildIds;
  },
});

export const getById = query({
  args: {
    guildId: v.id("guilds"),
  },
  handler: async (ctx, args) => {
    const guild = await ctx.db.get(args.guildId);

    return guild ? normalizeGuildDoc(guild) : null;
  },
});

export const getByDiscordId = query({
  args: {
    discordId: v.string(),
  },
  handler: async (ctx, args) => {
    const guild = await getGuildByDiscordId(ctx, args.discordId);

    return guild ? normalizeGuildDoc(guild) : null;
  },
});

export const resyncDashboardAdmins = mutation({
  args: {
    userId: v.string(),
    serverId: v.id("guilds"),
  },
  handler: async (ctx, args) => {
    const user = await getUserByDiscordId(ctx, args.userId);
    const guild = await ctx.db.get(args.serverId);
    if (!user || !guild) {
      throw new Error("Server not found.");
    }

    const guildDiscordId = getGuildDiscordId(guild);
    const discordAccess = await ctx.db
      .query("discordMemberAccess")
      .withIndex("guildId_userId", (q) => q.eq("guildId", guildDiscordId).eq("userId", args.userId))
      .unique();

    if (!discordAccess?.hasDashboardAccess && !guild.adminIds.includes(args.userId)) {
      throw new Error("Unauthorized.");
    }

    const accessRows = await ctx.db
      .query("discordMemberAccess")
      .withIndex("guildId", (q) => q.eq("guildId", guildDiscordId))
      .collect();

    const dashboardAdminIds = accessRows
      .filter((access) => access.hasDashboardAccess)
      .map((access) => access.userId);

    await ctx.db.patch(guild._id, {
      adminIds: dashboardAdminIds,
      updatedAt: new Date().toISOString(),
    });

    return {
      adminCount: dashboardAdminIds.length,
    };
  },
});

export const listAllInternal = query({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const guilds = await ctx.db.query("guilds").collect();
    return guilds.map((guild) => ({
      ...normalizeGuildDoc(guild),
      canAdmin: true,
    }));
  },
});

export const updateFrontendSettings = mutation({
  args: {
    secret: v.string(),
    guildId: v.id("guilds"),
    name: v.string(),
    avatar: v.string(),
    description: v.optional(v.string()),
    eventCategories: v.optional(v.array(v.object({
      id: v.string(),
      label: v.string(),
      color: v.string(),
      emoji: v.optional(v.string()),
    }))),
    calendarItems: v.optional(v.array(v.object({
      id: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      color: v.string(),
      emoji: v.optional(v.string()),
      label: v.optional(v.string()),
      startAt: v.string(),
      endAt: v.string(),
      allDay: v.boolean(),
      recurrence: v.optional(v.object({
        frequency: v.union(
          v.literal("weekly"),
          v.literal("monthly_date"),
          v.literal("monthly_nth_weekday"),
          v.literal("yearly"),
        ),
        interval: v.number(),
        until: v.optional(v.string()),
      })),
    }))),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const guild = await ctx.db.get(args.guildId);

    if (!guild) {
      throw new Error("Server not found.");
    }

    const now = new Date().toISOString();

    await ctx.db.patch(guild._id, {
      name: args.name.trim(),
      avatar: args.avatar.trim(),
      description: args.description?.trim() || undefined,
      eventCategories: (args.eventCategories ?? [])
        .map((category) => ({
          id: category.id.trim(),
          label: category.label.trim(),
          color: category.color.trim(),
          emoji: category.emoji?.trim() || undefined,
        }))
        .filter((category) => category.id && category.label && category.color),
      updatedAt: now,
    });

    const existingCalendarItems = await ctx.db
      .query("calendarItems")
      .withIndex("guildId", (q) => q.eq("guildId", getGuildDiscordId(guild)))
      .collect();
    const normalizedCalendarItems = (args.calendarItems ?? [])
      .map((item) => ({
        id: item.id.trim(),
        title: item.title.trim(),
        description: item.description?.trim() || undefined,
        color: item.color.trim(),
        emoji: item.emoji?.trim() || undefined,
        label: item.label?.trim() || undefined,
        startAt: item.startAt,
        endAt: item.endAt,
        allDay: item.allDay,
        recurrence: item.recurrence ? {
          frequency: item.recurrence.frequency,
          interval: Math.max(1, Math.floor(item.recurrence.interval)),
          until: item.recurrence.until,
        } : undefined,
      }))
      .filter((item) => item.id && item.title && item.color);
    const nextIds = new Set(normalizedCalendarItems.map((item) => item.id));

    for (const existingItem of existingCalendarItems) {
      if (!nextIds.has(String(existingItem._id))) {
        await ctx.db.delete(existingItem._id);
      }
    }

    const existingById = new Map(existingCalendarItems.map((item) => [String(item._id), item]));
    for (const item of normalizedCalendarItems) {
      const existingItem = existingById.get(item.id);
      if (existingItem) {
        await ctx.db.patch(existingItem._id, {
          title: item.title,
          description: item.description,
          color: item.color,
          emoji: item.emoji,
          label: item.label,
          startAt: item.startAt,
          endAt: item.endAt,
          allDay: item.allDay,
          recurrence: item.recurrence,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("calendarItems", {
          guildId: getGuildDiscordId(guild),
          title: item.title,
          description: item.description,
          color: item.color,
          emoji: item.emoji,
          label: item.label,
          startAt: item.startAt,
          endAt: item.endAt,
          allDay: item.allDay,
          recurrence: item.recurrence,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return String(guild._id);
  },
});

export const backfillRosterScoreSettings = mutation({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const now = new Date().toISOString();
    const configs = await ctx.db.query("discordConfigs").collect();
    let patchedCount = 0;

    for (const config of configs) {
      const normalized = normalizeRosterScoreSettings(config.membershipSettings?.rosterScoreSettings);
      const alreadyNormalized =
        config.membershipSettings?.rosterScoreSettings?.noCategory === normalized.noCategory &&
        config.membershipSettings?.rosterScoreSettings?.declined === normalized.declined &&
        config.membershipSettings?.rosterScoreSettings?.rosterPresent === normalized.rosterPresent &&
        config.membershipSettings?.rosterScoreSettings?.reservePresent === normalized.reservePresent &&
        config.membershipSettings?.rosterScoreSettings?.rosterAbsent === normalized.rosterAbsent &&
        config.membershipSettings?.rosterScoreSettings?.reserveAbsent === normalized.reserveAbsent &&
        config.membershipSettings?.rosterScoreSettings?.excusedAbsence === normalized.excusedAbsence;

      if (alreadyNormalized) {
        continue;
      }

      await ctx.db.patch(config._id, {
        membershipSettings: config.membershipSettings ? {
          ...config.membershipSettings,
          rosterScoreSettings: normalized,
        } : undefined,
        updatedAt: now,
      });
      patchedCount += 1;
    }

    return {
      patchedCount,
    };
  },
});
