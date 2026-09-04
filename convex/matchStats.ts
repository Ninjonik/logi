import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

const statBreakdown = v.record(v.string(), v.number());

const matchPlayerTeam = v.object({
  side: v.string(),
  confidence: v.optional(v.union(v.literal("strong"), v.literal("mixed"))),
  ratio: v.optional(v.number()),
});

const matchPlayerSteamInfo = v.object({
  id: v.number(),
  created: v.string(),
  updated: v.union(v.string(), v.null()),
  profile: v.union(v.string(), v.null()),
  country: v.union(v.string(), v.null()),
  bans: v.union(v.number(), v.null()),
  has_bans: v.boolean(),
});

const matchPlayerUnit = v.object({
  ts: v.number(),
  team: v.number(),
  squad: v.number(),
  role: v.number(),
});

const matchPlayerEncounter = v.object({
  action: v.string(),
  player_id: v.string(),
  player_name: v.string(),
  ts: v.number(),
  weapon: v.string(),
});

const matchPlayerStat = v.object({
  id: v.number(),
  player_id: v.string(),
  player: v.string(),
  map_id: v.number(),
  kills: v.number(),
  kills_by_type: v.optional(statBreakdown),
  kills_streak: v.number(),
  deaths: v.number(),
  deaths_by_type: v.optional(statBreakdown),
  deaths_without_kill_streak: v.number(),
  teamkills: v.number(),
  teamkills_streak: v.number(),
  deaths_by_tk: v.number(),
  deaths_by_tk_streak: v.number(),
  nb_vote_started: v.number(),
  nb_voted_yes: v.number(),
  nb_voted_no: v.number(),
  time_seconds: v.number(),
  kills_per_minute: v.number(),
  deaths_per_minute: v.number(),
  kill_death_ratio: v.number(),
  longest_life_secs: v.number(),
  shortest_life_secs: v.number(),
  combat: v.number(),
  offense: v.number(),
  defense: v.number(),
  support: v.number(),
  most_killed: v.record(v.string(), v.number()),
  death_by: v.record(v.string(), v.number()),
  weapons: v.record(v.string(), v.number()),
  death_by_weapons: v.record(v.string(), v.number()),
  team: matchPlayerTeam,
  level: v.number(),
  platform: v.optional(v.string()),
  steaminfo: v.optional(matchPlayerSteamInfo),
  vehicle_kills: v.optional(v.number()),
  vehicles_destroyed: v.optional(v.number()),
  kills_and_assists: v.optional(v.number()),
  deaths_and_redeploys: v.optional(v.number()),
  units: v.optional(v.array(matchPlayerUnit)),
  encounters: v.optional(v.array(matchPlayerEncounter)),
});

const rawMatch = v.object({
  id: v.number(),
  creation_time: v.string(),
  start: v.string(),
  end: v.string(),
  server_number: v.number(),
  map_name: v.string(),
  result: v.object({
    axis: v.number(),
    allied: v.number(),
  }),
  game_layout: v.object({
    requested: v.array(v.union(v.number(), v.null())),
    set: v.array(v.string()),
  }),
  cap_flips: v.optional(v.array(v.object({
    allied_score: v.number(),
    axis_score: v.number(),
    ts: v.number(),
  }))),
  match_time: v.optional(v.number()),
  player_stats: v.array(matchPlayerStat),
  map: v.object({
    id: v.string(),
    game_mode: v.string(),
    attackers: v.optional(v.union(v.string(), v.null())),
    environment: v.string(),
    pretty_name: v.string(),
    image_name: v.string(),
    map: v.object({
      id: v.string(),
      name: v.string(),
      tag: v.string(),
      pretty_name: v.string(),
      shortname: v.string(),
      allies: v.object({
        name: v.string(),
        team: v.string(),
      }),
      axis: v.object({
        name: v.string(),
        team: v.string(),
      }),
      orientation: v.string(),
    }),
  }),
});

function normalizeDoc<T extends { _id: unknown; eventId: unknown; matchId: string }>(doc: T) {
  return {
    ...doc,
    id: String(doc._id),
    eventId: String(doc.eventId),
    matchId: doc.matchId,
  };
}

async function upsertMatchPreview(ctx: MutationCtx, event: Pick<Doc<"events">, "_id" | "name">, raw: { map: { pretty_name: string }; result: { allied: number; axis: number } }, now: string) {
  const entityId = String(event._id);
  const score = `${raw.result.allied} – ${raw.result.axis}`;
  const existing = await ctx.db.query("publicPreviews").withIndex("entity", (q) => q.eq("entityType", "match").eq("entityId", entityId)).unique();
  const preview = { entityType: "match" as const, entityId, title: `${event.name} · ${score}`, description: `${raw.map.pretty_name} · Recorded match result`, imageVersion: now, updatedAt: now, expiresAt: new Date(new Date(now).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() };
  if (existing) await ctx.db.patch(existing._id, preview); else await ctx.db.insert("publicPreviews", preview);
}

function previewExpiry(now: string) {
  return new Date(new Date(now).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

async function upsertPreview(ctx: MutationCtx, entityType: "player" | "clan", entityId: string, title: string, description: string, now: string) {
  const existing = await ctx.db.query("publicPreviews").withIndex("entity", (q) => q.eq("entityType", entityType).eq("entityId", entityId)).unique();
  const preview = { entityType, entityId, title, description, imageVersion: now, updatedAt: now, expiresAt: previewExpiry(now) };
  if (existing) await ctx.db.patch(existing._id, preview); else await ctx.db.insert("publicPreviews", preview);
}

async function refreshRelatedPreviews(ctx: MutationCtx, event: Pick<Doc<"events">, "_id" | "guildId">, now: string) {
  const guild = await ctx.db.query("guilds").withIndex("discordId", (q) => q.eq("discordId", event.guildId)).unique()
    ?? await ctx.db.query("guilds").withIndex("id", (q) => q.eq("id", event.guildId)).unique();
  if (guild) await upsertPreview(ctx, "clan", event.guildId, guild.name, "Public clan profile and recorded match history.", now);

  const stats = await ctx.db.query("playerStats").collect();
  const linked = stats.filter((entry) => entry.userId && Object.prototype.hasOwnProperty.call(entry.matches, String(event._id)));
  await Promise.all(linked.map(async (entry) => {
    const user = await ctx.db.query("users").withIndex("id", (q) => q.eq("id", entry.userId!)).unique()
      ?? await ctx.db.query("users").withIndex("discordId", (q) => q.eq("discordId", entry.userId!)).unique();
    if (!user) return;
    const matches = Object.values(entry.matches);
    const kills = matches.reduce((total, match) => total + match.kills, 0);
    const deaths = matches.reduce((total, match) => total + match.deaths, 0);
    await upsertPreview(ctx, "player", entry.userId!, user.name, `${matches.length} recorded matches · ${(deaths ? kills / deaths : kills).toFixed(2)} K/D`, now);
  }));
}

export const upsertForEvent = mutation({
  args: {
    secret: v.string(),
    eventId: v.id("events"),
    sourceUrl: v.string(),
    raw: rawMatch,
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found.");
    }

    const existing = await ctx.db
      .query("matchStats")
      .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
      .unique();
    const now = new Date().toISOString();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sourceUrl: args.sourceUrl,
        matchId: String(args.raw.id),
        importedAt: now,
        raw: args.raw,
        updatedAt: now,
      });

      await ctx.db.patch(args.eventId, {
        matchStatsId: existing._id,
        updatedAt: now,
      });
      await upsertMatchPreview(ctx, event, args.raw, now);
      await refreshRelatedPreviews(ctx, event, now);

      return String(existing._id);
    }

    const insertedId = await ctx.db.insert("matchStats", {
      guildId: event.guildId,
      eventId: args.eventId,
      sourceUrl: args.sourceUrl,
      matchId: String(args.raw.id),
      importedAt: now,
      raw: args.raw,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.eventId, {
      matchStatsId: insertedId,
      updatedAt: now,
    });
    await upsertMatchPreview(ctx, event, args.raw, now);
    await refreshRelatedPreviews(ctx, event, now);

    return String(insertedId);
  },
});

export const getByEventId = query({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    const matchStats = await ctx.db
      .query("matchStats")
      .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
      .unique();

    return matchStats ? normalizeDoc(matchStats) : null;
  },
});

export const findByIdentity = query({
  args: {
    guildId: v.string(),
    sourceUrl: v.string(),
    matchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedSourceUrl = args.sourceUrl.trim();
    const normalizedMatchId = args.matchId?.trim();
    const docs = await ctx.db
      .query("matchStats")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .collect();

    const matchStats = docs.find((doc) => {
      if (normalizedSourceUrl && doc.sourceUrl.trim() === normalizedSourceUrl) {
        return true;
      }

      return Boolean(normalizedMatchId) && doc.matchId.trim() === normalizedMatchId;
    });

    return matchStats ? normalizeDoc(matchStats) : null;
  },
});
