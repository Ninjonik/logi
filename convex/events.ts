import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

export const upsert = mutation({
  args: {
    secret: v.string(),
    serverId: v.string(),
    eventId: v.optional(v.id("events")),
    name: v.string(),
    description: v.optional(v.string()),
    server: v.optional(v.string()),
    serverPassword: v.optional(v.string()),
    side: v.optional(v.string()),
    map: v.optional(v.string()),
    cap: v.optional(v.string()),
    notes: v.optional(v.string()),
    registrationEnd: v.string(),
    meetingStart: v.string(),
    gameStart: v.string(),
    gameEnd: v.string(),
    pingClan: v.boolean(),
    topicPresetId: v.optional(v.id("topicPresets")),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const guild = await ctx.db.query("guilds").withIndex("id", (q) => q.eq("id", args.serverId)).unique();
    if (!guild) {
      throw new Error("Server not found.");
    }

    const payload = {
      guildId: args.serverId,
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      server: args.server?.trim() || undefined,
      serverPassword: args.serverPassword?.trim() || undefined,
      side: args.side?.trim() || undefined,
      map: args.map?.trim() || undefined,
      cap: args.cap?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      registrationEnd: args.registrationEnd,
      meetingStart: args.meetingStart,
      gameStart: args.gameStart,
      gameEnd: args.gameEnd,
      pingClan: args.pingClan,
      topicPresetId: args.topicPresetId,
      updatedAt: new Date().toISOString(),
    };

    if (args.eventId) {
      await ctx.db.patch(args.eventId, payload);
      return String(args.eventId);
    }

    const now = new Date().toISOString();
    const eventId = await ctx.db.insert("events", {
      ...payload,
      signUps: [],
      createdAt: now,
      updatedAt: now,
    });

    return String(eventId);
  },
});

export const getById = query({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    return event ? { ...event, id: String(event._id) } : null;
  },
});

export const toggleSignUp = mutation({
  args: {
    secret: v.string(),
    eventId: v.id("events"),
    userId: v.string(),
    group: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found.");
    }

    const existing = event.signUps.find((signUp) => signUp.userId === args.userId);
    let signUps = event.signUps.filter((signUp) => signUp.userId !== args.userId);

    if (!existing || existing.group !== args.group) {
      signUps = [...signUps, { userId: args.userId, group: args.group }];
    }

    await ctx.db.patch(args.eventId, {
      signUps,
      updatedAt: new Date().toISOString(),
    });

    return signUps;
  },
});
