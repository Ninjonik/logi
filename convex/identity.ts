import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type DbCtx = Pick<QueryCtx | MutationCtx, "db">;

type LegacyGuild = Doc<"guilds"> & { id?: string; discordId?: string };
type LegacyUser = Doc<"users"> & { id?: string; discordId?: string };

export function getGuildDiscordId(guild: Pick<LegacyGuild, "discordId"> & { id?: string }) {
  return guild.discordId ?? guild.id ?? "";
}

export function getUserDiscordId(user: Pick<LegacyUser, "discordId"> & { id?: string }) {
  return user.discordId ?? user.id ?? "";
}

export async function getGuildByDiscordId(ctx: DbCtx, discordId: string) {
  return (
    await ctx.db.query("guilds").withIndex("discordId", (q) => q.eq("discordId", discordId)).unique()
  ) ?? (
    await ctx.db.query("guilds").withIndex("id", (q) => q.eq("id", discordId)).unique()
  );
}

export async function getUserByDiscordId(ctx: DbCtx, discordId: string) {
  return (
    await ctx.db.query("users").withIndex("discordId", (q) => q.eq("discordId", discordId)).unique()
  ) ?? (
    await ctx.db.query("users").withIndex("id", (q) => q.eq("id", discordId)).unique()
  );
}

export async function getGuildById(ctx: DbCtx, guildId: string) {
  return await ctx.db.get(guildId as Id<"guilds">);
}
