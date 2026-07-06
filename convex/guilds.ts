import { query } from "./_generated/server";

export const visibleForCurrentPlayer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("id", (q) => q.eq("id", identity.subject!))
      .unique();
    if (!user) {
      return [];
    }

    const ids = new Set<string>();
    if (user.guildId) ids.add(user.guildId);
    for (const id of user.managedGuildIds) ids.add(id);
    for (const id of user.mercenaryGuildIds) ids.add(id);

    const guilds = await ctx.db.query("guilds").collect();
    return guilds.filter((guild) => ids.has(guild.id));
  },
});
