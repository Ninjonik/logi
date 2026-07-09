import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

const attendanceReminder = v.object({
  userId: v.string(),
  offsetHours: v.number(),
  sentAt: v.string(),
});

function deriveEventStatus(event: {
  registrationEnd: string;
  meetingStart: string;
  gameEnd: string;
  status: "registration" | "closed" | "starting" | "concluded";
}) {
  if (event.status === "concluded") {
    return "concluded" as const;
  }

  const now = Date.now();
  const registrationEnd = new Date(event.registrationEnd).getTime();
  const startingAt = new Date(event.meetingStart).getTime() - 24 * 60 * 60 * 1000;
  const gameEnd = new Date(event.gameEnd).getTime();

  if (Number.isFinite(gameEnd) && now >= gameEnd) {
    return "concluded" as const;
  }
  if (Number.isFinite(startingAt) && now >= startingAt) {
    return "starting" as const;
  }
  if (Number.isFinite(registrationEnd) && now >= registrationEnd) {
    return "closed" as const;
  }
  return "registration" as const;
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
      status: "registration" as const,
      updatedAt: new Date().toISOString(),
    };

    if (args.eventId) {
      const existing = await ctx.db.get(args.eventId);
      const derivedStatus = existing
        ? deriveEventStatus({
          registrationEnd: args.registrationEnd,
          meetingStart: args.meetingStart,
          gameEnd: args.gameEnd,
          status: existing.status,
        })
        : "registration";

      await ctx.db.patch(args.eventId, {
        ...payload,
        status: derivedStatus,
        statusUpdatedAt: new Date().toISOString(),
        concludedAt: derivedStatus === "concluded" ? existing?.concludedAt ?? new Date().toISOString() : undefined,
      });
      return String(args.eventId);
    }

    const now = new Date().toISOString();
    const eventId = await ctx.db.insert("events", {
      ...payload,
      status: "registration",
      statusUpdatedAt: now,
      attendanceReminderLog: [],
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

    if (event.status !== "registration") {
      throw new Error("Signups are closed for this event.");
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

export const reconcileStatuses = mutation({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const events = await ctx.db.query("events").collect();
    const now = new Date().toISOString();
    const changedEventIds: string[] = [];

    for (const event of events) {
      const nextStatus = deriveEventStatus(event);
      if (nextStatus === event.status) continue;

      await ctx.db.patch(event._id, {
        status: nextStatus,
        statusUpdatedAt: now,
        concludedAt: nextStatus === "concluded" ? event.concludedAt ?? now : undefined,
        updatedAt: now,
      });
      changedEventIds.push(String(event._id));
    }

    return changedEventIds;
  },
});

export const conclude = mutation({
  args: {
    secret: v.string(),
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found.");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.eventId, {
      status: "concluded",
      statusUpdatedAt: now,
      concludedAt: now,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const appendAttendanceReminderLog = mutation({
  args: {
    secret: v.string(),
    eventId: v.id("events"),
    reminders: v.array(attendanceReminder),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found.");
    }

    await ctx.db.patch(args.eventId, {
      attendanceReminderLog: [...event.attendanceReminderLog, ...args.reminders],
      updatedAt: new Date().toISOString(),
    });

    return { ok: true };
  },
});
