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

export const updateFrontendSettings = mutation({
  args: {
    secret: v.string(),
    guildId: v.id("guilds"),
    name: v.string(),
    avatar: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const guild = await ctx.db.get(args.guildId);

    if (!guild) {
      throw new Error("Server not found.");
    }

    await ctx.db.patch(guild._id, {
      name: args.name.trim(),
      avatar: args.avatar.trim(),
      description: args.description?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    });

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
