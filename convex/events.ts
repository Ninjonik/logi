import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { DEFAULT_ROSTER_SCORE_SETTINGS } from "./guilds";

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

const eventResult = v.object({
  sourceUrl: v.string(),
  mapId: v.string(),
  mapName: v.optional(v.string()),
  endedAt: v.optional(v.string()),
  importedAt: v.string(),
  sideA: v.string(),
  sideB: v.string(),
  outcome: v.union(v.literal("victory"), v.literal("defeat"), v.literal("draw")),
  score: v.object({
    sideA: v.number(),
    sideB: v.number(),
  }),
});

const SIGNUP_NOT_ATTENDING = "NOT_ATTENDING";

function normalizeOptionalArray<T>(value: T[] | undefined) {
  return Array.isArray(value) ? value : [];
}

function getSignUpScoreCategory(
  signUp: { group?: string | null } | undefined,
): "noResponse" | "declined" | "accepted" {
  if (!signUp || !signUp.group) {
    return "noResponse";
  }

  if (signUp.group === SIGNUP_NOT_ATTENDING) {
    return "declined";
  }

  return "accepted";
}

function normalizeEventRecord<T extends {
  _id: unknown;
  registrationEnd: string;
  meetingStart: string;
  gameEnd: string;
  status?: "registration" | "closed" | "starting" | "concluded";
  statusUpdatedAt?: string;
  concludedAt?: string;
  eventResult?: {
    sourceUrl: string;
    mapId: string;
    mapName?: string;
    endedAt?: string;
    importedAt: string;
    sideA: string;
    sideB: string;
    outcome: "victory" | "defeat" | "draw";
    score: {
      sideA: number;
      sideB: number;
    };
  };
  matchId?: Id<"matches">;
  attendanceReminderLog?: Array<{ userId: string; offsetHours: number; sentAt: string }>;
  signUps?: Array<{ userId: string; group?: string | null }>;
  scoreAppliedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}>(event: T) {
  const status = event.status ?? deriveEventStatus(event);
  const timestamp = event.updatedAt ?? event.createdAt ?? new Date().toISOString();

  return {
    ...event,
    status,
    statusUpdatedAt: event.statusUpdatedAt ?? timestamp,
    concludedAt: event.concludedAt,
    eventResult: event.eventResult,
    matchId: event.matchId,
    attendanceReminderLog: normalizeOptionalArray(event.attendanceReminderLog),
    signUps: normalizeOptionalArray(event.signUps),
    scoreAppliedAt: event.scoreAppliedAt,
    updatedAt: event.updatedAt ?? timestamp,
  };
}

function deriveEventStatus(event: {
  registrationEnd: string;
  meetingStart: string;
  gameEnd: string;
  status?: "registration" | "closed" | "starting" | "concluded";
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

async function reconcileRosterAttendance(ctx: MutationCtx, args: {
  eventId: Id<"events">;
  userId: string;
  attending: boolean;
}) {
  const roster = await ctx.db
    .query("rosters")
    .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
    .unique();

  if (!roster) return;

  const reservePlayerIds = roster.reservePlayerIds.filter((id) => id !== args.userId);
  const notAttendingPlayerIds = roster.notAttendingPlayerIds.filter((id) => id !== args.userId);
  let isAssignedToSlot = false;

  const squads = roster.squads.map((squad) => ({
    ...squad,
    players: squad.players.map((player) => {
      if (player.id !== args.userId) {
        return player;
      }

      if (args.attending) {
        isAssignedToSlot = true;
        return player;
      }

      return {
        ...player,
        id: undefined,
        ack: false,
        confirmed: false,
      };
    }),
  }));

  if (args.attending) {
    if (!isAssignedToSlot) {
      reservePlayerIds.push(args.userId);
    }
  } else {
    notAttendingPlayerIds.push(args.userId);
  }

  await ctx.db.patch(roster._id, {
    squads,
    reservePlayerIds,
    notAttendingPlayerIds,
    updatedAt: new Date().toISOString(),
  });
}

async function applyScoreToEventSignups(
  ctx: MutationCtx,
  eventId: Id<"events">,
) {
  const event = await ctx.db.get(eventId);
  if (!event) {
    throw new Error("Event not found.");
  }

  const normalizedEvent = normalizeEventRecord(event);
  if (normalizedEvent.scoreAppliedAt || normalizedEvent.status === "registration") {
    return false;
  }

  const guild = await ctx.db
    .query("guilds")
    .withIndex("id", (q) => q.eq("id", normalizedEvent.guildId))
    .unique();
  if (!guild) {
    throw new Error("Server not found.");
  }

  const scoreSettings = guild.rosterScoreSettings ?? DEFAULT_ROSTER_SCORE_SETTINGS;
  const assignments = await ctx.db
    .query("userAssignments")
    .withIndex("serverId", (q) => q.eq("serverId", normalizedEvent.guildId))
    .collect();

  const activeAssignments = assignments.filter((assignment) => !assignment.paused);
  const signUpByUserId = new Map(normalizedEvent.signUps.map((signUp) => [signUp.userId, signUp]));
  const users = await Promise.all(
    activeAssignments.map((assignment) =>
      ctx.db.query("users").withIndex("id", (q) => q.eq("id", assignment.userId)).unique(),
    ),
  );

  for (const user of users) {
    if (!user) continue;
    const signUp = signUpByUserId.get(user.id);
    const category = getSignUpScoreCategory(signUp);
    const delta = scoreSettings[category];

    await ctx.db.patch(user._id, {
      score: user.score + delta,
      updatedAt: new Date().toISOString(),
    });
  }

  await ctx.db.patch(eventId, {
    scoreAppliedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return true;
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
        eventResult: existing?.eventResult,
        matchId: existing?.matchId,
        attendanceReminderLog: normalizeOptionalArray(existing?.attendanceReminderLog),
        signUps: normalizeOptionalArray(existing?.signUps),
        scoreAppliedAt: existing?.scoreAppliedAt,
      });

      if (derivedStatus !== "registration") {
        await applyScoreToEventSignups(ctx, args.eventId);
      }
      return String(args.eventId);
    }

    const now = new Date().toISOString();
    const eventId = await ctx.db.insert("events", {
      ...payload,
      status: "registration",
      statusUpdatedAt: now,
      attendanceReminderLog: [],
      signUps: [],
      scoreAppliedAt: undefined,
      eventResult: undefined,
      matchId: undefined,
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
    return event ? { ...normalizeEventRecord(event), id: String(event._id) } : null;
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

    const normalizedEvent = normalizeEventRecord(event);

    if (normalizedEvent.status !== "registration") {
      throw new Error("Signups are closed for this event.");
    }

    const existing = normalizedEvent.signUps.find((signUp) => signUp.userId === args.userId);
    let signUps = normalizedEvent.signUps.filter((signUp) => signUp.userId !== args.userId);
    const shouldRemoveSignup = Boolean(existing && existing.group === args.group);
    const attending = !shouldRemoveSignup && Boolean(args.group && args.group !== SIGNUP_NOT_ATTENDING);

    if (!shouldRemoveSignup) {
      signUps = [...signUps, { userId: args.userId, group: args.group }];
    }

    await ctx.db.patch(args.eventId, {
      signUps,
      updatedAt: new Date().toISOString(),
    });
    await reconcileRosterAttendance(ctx, {
      eventId: args.eventId,
      userId: args.userId,
      attending,
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
      const normalizedEvent = normalizeEventRecord(event);
      const nextStatus = deriveEventStatus(normalizedEvent);
      const shouldPatch =
        nextStatus !== event.status ||
        !event.statusUpdatedAt ||
        !event.attendanceReminderLog ||
        !event.signUps ||
        (nextStatus !== "registration" && !event.scoreAppliedAt) ||
        !event.updatedAt;

      if (!shouldPatch) continue;

      await ctx.db.patch(event._id, {
        status: nextStatus,
        statusUpdatedAt: nextStatus !== event.status ? now : normalizedEvent.statusUpdatedAt,
        concludedAt: nextStatus === "concluded" ? event.concludedAt ?? now : undefined,
        eventResult: event.eventResult,
        matchId: event.matchId,
        attendanceReminderLog: normalizedEvent.attendanceReminderLog,
        signUps: normalizedEvent.signUps,
        scoreAppliedAt: event.scoreAppliedAt,
        updatedAt: now,
      });

      if (nextStatus !== "registration") {
        await applyScoreToEventSignups(ctx, event._id);
      }
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

    await applyScoreToEventSignups(ctx, args.eventId);

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

    const normalizedEvent = normalizeEventRecord(event);

    await ctx.db.patch(args.eventId, {
      attendanceReminderLog: [...normalizedEvent.attendanceReminderLog, ...args.reminders],
      updatedAt: new Date().toISOString(),
    });

    return { ok: true };
  },
});

export const setResult = mutation({
  args: {
    secret: v.string(),
    eventId: v.id("events"),
    eventResult,
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found.");
    }

    await ctx.db.patch(args.eventId, {
      eventResult: args.eventResult,
      updatedAt: new Date().toISOString(),
    });

    return { ok: true };
  },
});
