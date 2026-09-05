import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { getGuildByDiscordId, getGuildDiscordId } from "./identity";
import { normalizeAssignmentDoc, normalizeCalendarItemDoc, normalizeDoc, normalizeEventDoc, normalizeGuildDoc, normalizeStratmapDoc } from "../src/infrastructure/convex/server-read-model";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";
function assertInternalSecret(secret: string) { if (secret !== INTERNAL_AUTH_SECRET) throw new Error("Unauthorized."); }

function websiteEvent(event: Parameters<typeof normalizeEventDoc>[0]) {
  const normalized = normalizeEventDoc(event);
  const safe = { ...normalized } as Record<string, unknown>;
  for (const field of ["serverPassword", "announcementChannelId", "eventInfoChannelId", "meetingChannelId", "requiredRoleIds", "rewardRoleIds", "pingRoleIds", "attendeeRoleId", "reserveRoleId", "attendanceReminderLog", "absenceNotices"]) delete safe[field];
  return safe;
}

function websiteClan(guild: Parameters<typeof normalizeGuildDoc>[0]) {
  const normalized = normalizeGuildDoc(guild);
  const safe = { ...normalized } as Record<string, unknown>;
  for (const field of ["adminIds", "memberIds", "mercenaryIds", "members"]) delete safe[field];
  return safe;
}

export const createKey = mutation({
  args: { secret: v.string(), guildId: v.string(), name: v.string(), keyHash: v.string(), keyPrefix: v.string() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    if (!(await getGuildByDiscordId(ctx, args.guildId))) throw new Error("Clan not found.");
    return await ctx.db.insert("apiKeys", { guildId: args.guildId, name: args.name.trim().slice(0, 80) || "Website", keyHash: args.keyHash, keyPrefix: args.keyPrefix, createdAt: new Date().toISOString() });
  },
});

export const listKeys = query({
  args: { secret: v.string(), guildId: v.string() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    return (await ctx.db.query("apiKeys").withIndex("guildId", q => q.eq("guildId", args.guildId)).collect()).map(key => ({ id: String(key._id), name: key.name, keyPrefix: key.keyPrefix, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt, revokedAt: key.revokedAt }));
  },
});

export const revokeKey = mutation({
  args: { secret: v.string(), guildId: v.string(), keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const key = await ctx.db.get(args.keyId);
    if (!key || key.guildId !== args.guildId) throw new Error("API key not found.");
    await ctx.db.patch(args.keyId, { revokedAt: new Date().toISOString() });
  },
});

export const checkRateLimit = mutation({
  args: { secret: v.string(), bucket: v.string(), limit: v.number(), windowMs: v.number() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const now = Date.now();
    const existing = await ctx.db.query("apiRateLimitBuckets").withIndex("bucket", q => q.eq("bucket", args.bucket)).unique();
    if (!existing || existing.resetAt <= now) {
      if (existing) await ctx.db.patch(existing._id, { count: 1, resetAt: now + args.windowMs });
      else await ctx.db.insert("apiRateLimitBuckets", { bucket: args.bucket, count: 1, resetAt: now + args.windowMs });
      return { allowed: true, remaining: args.limit - 1, resetAt: now + args.windowMs };
    }
    if (existing.count >= args.limit) return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return { allowed: true, remaining: args.limit - existing.count - 1, resetAt: existing.resetAt };
  },
});

/** Read projection for a clan-owned website. It deliberately excludes Discord credentials,
 * ticket/application content, private notes, and platform identifiers. */
export const getClanData = query({
  args: { secret: v.string(), keyHash: v.string() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const key = await ctx.db.query("apiKeys").withIndex("keyHash", q => q.eq("keyHash", args.keyHash)).unique();
    if (!key || key.revokedAt) return null;
    const guild = await getGuildByDiscordId(ctx, key.guildId);
    if (!guild) return null;
    const guildId = getGuildDiscordId(guild);
    const [events, groups, assignments, calendarItems, stratmaps, topicPresets, squadPresets, matchStats, articles] = await Promise.all([
      ctx.db.query("events").withIndex("guildId", q => q.eq("guildId", guildId)).collect(),
      ctx.db.query("groups").withIndex("guildId", q => q.eq("guildId", guildId)).collect(),
      ctx.db.query("userAssignments").withIndex("serverId", q => q.eq("serverId", guildId)).collect(),
      ctx.db.query("calendarItems").withIndex("guildId", q => q.eq("guildId", guildId)).collect(),
      ctx.db.query("stratmaps").withIndex("guildId", q => q.eq("guildId", guildId)).collect(),
      ctx.db.query("topicPresets").withIndex("guildId", q => q.eq("guildId", guildId)).collect(),
      ctx.db.query("squadPresets").withIndex("guildId", q => q.eq("guildId", guildId)).collect(),
      ctx.db.query("matchStats").withIndex("guildId", q => q.eq("guildId", guildId)).collect(),
      ctx.db.query("articles").withIndex("guildId", q => q.eq("guildId", guildId)).collect(),
    ]);
    const rosters = (await Promise.all(events.map(event => ctx.db.query("rosters").withIndex("eventId", q => q.eq("eventId", event._id)).unique()))).filter((roster): roster is NonNullable<typeof roster> => Boolean(roster));
    const groupNames = new Map(groups.map(group => [String(group._id), group.name]));
    return {
      clan: websiteClan(guild), events: events.map(websiteEvent), groups: groups.map(normalizeDoc), rosters: rosters.map(normalizeDoc),
      assignments: assignments.map(assignment => normalizeAssignmentDoc(assignment, groupNames)), calendarItems: calendarItems.map(normalizeCalendarItemDoc),
      stratmaps: stratmaps.map(normalizeStratmapDoc), topicPresets: topicPresets.map(normalizeDoc), squadPresets: squadPresets.map(normalizeDoc), articles: articles.map(normalizeDoc),
      matches: matchStats.map(match => ({ ...match, id: String(match._id), eventId: String(match.eventId) })),
    };
  },
});
