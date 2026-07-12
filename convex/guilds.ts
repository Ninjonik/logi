import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

export const visibleForUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("id", (q) => q.eq("id", args.userId))
      .unique();

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
          ctx.db.query("guilds").withIndex("id", (q) => q.eq("id", guildId)).unique(),
        ),
      )
    ).filter((guild): guild is NonNullable<typeof guild> => Boolean(guild));

    return guilds.map((guild) => ({
        ...guild,
        canAdmin: guild.adminIds.includes(args.userId) || adminGuildIds.has(guild.id),
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

    const user = await ctx.db
      .query("users")
      .withIndex("id", (q) => q.eq("id", args.userId))
      .unique();

    if (!user) {
      throw new Error("Player not found.");
    }

    const now = new Date().toISOString();
    const managedGuildIds = args.guilds.map((guild) => guild.id);

    for (const guild of args.guilds) {
      const existing = await ctx.db
        .query("guilds")
        .withIndex("id", (q) => q.eq("id", guild.id))
        .unique();

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
        continue;
      }

      await ctx.db.insert("guilds", {
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
    }

    const currentGuilds = await ctx.db.query("guilds").collect();
    for (const guild of currentGuilds) {
      if (!guild.adminIds.includes(args.userId)) {
        continue;
      }

      if (managedGuildIds.includes(guild.id)) {
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
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("guilds")
      .withIndex("id", (q) => q.eq("id", args.guildId))
      .unique();
  },
});

export const updateFrontendSettings = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    name: v.string(),
    avatar: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const guild = await ctx.db
      .query("guilds")
      .withIndex("id", (q) => q.eq("id", args.guildId))
      .unique();

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
