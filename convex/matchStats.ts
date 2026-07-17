import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

const statBreakdown = v.object({
  infantry: v.optional(v.number()),
  mine: v.optional(v.number()),
  sniper: v.optional(v.number()),
  armor: v.optional(v.number()),
  satchel: v.optional(v.number()),
  grenade: v.optional(v.number()),
  machine_gun: v.optional(v.number()),
  bazooka: v.optional(v.number()),
  artillery: v.optional(v.number()),
  commander: v.optional(v.number()),
});

const matchPlayerTeam = v.object({
  side: v.string(),
  confidence: v.optional(v.union(v.literal("strong"), v.literal("mixed"))),
  ratio: v.optional(v.number()),
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
