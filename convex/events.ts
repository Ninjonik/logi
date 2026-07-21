import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { DEFAULT_ROSTER_SCORE_SETTINGS } from "./guilds";
import { getGuildByDiscordId, getGuildById, getGuildDiscordId, getUserByDiscordId, getUserDiscordId } from "./identity";
import { syncRosterMembershipForUser } from "./rosterSync";

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

type ParticipantRecord = {
  userId: string;
  status: "attending" | "not_attending";
  group?: string | null;
  completed?: "passed" | "failed";
  updatedAt: string;
};

type EventNoticeRecord = {
  userId: string;
  reason: string;
  createdAt: string;
};

type ReserveAttendanceRecord = {
  userId: string;
  ack: boolean;
  confirmed?: boolean;
};

function normalizeOptionalArray<T>(value: T[] | undefined) {
  return Array.isArray(value) ? value : [];
}

function normalizeParticipants(
  participants: ParticipantRecord[] | undefined,
  signUps: Array<{ userId: string; group?: string | null }> | undefined,
) {
  if (Array.isArray(participants) && participants.length > 0) {
    return participants;
  }

  return normalizeOptionalArray(signUps).map((signUp) => ({
    userId: signUp.userId,
    status: signUp.group && signUp.group !== SIGNUP_NOT_ATTENDING ? "attending" as const : "not_attending" as const,
    group: signUp.group,
    updatedAt: new Date().toISOString(),
  }));
}

function participantsToSignUps(participants: ParticipantRecord[]) {
  return participants.map((participant) => ({
    userId: participant.userId,
    group: participant.status === "attending" ? (participant.group ?? "ATTENDING") : SIGNUP_NOT_ATTENDING,
  }));
}

function isTrainingRegistrationStillOpen(event: {
  kind?: "match" | "training";
  registrationEnd: string;
  status?: "registration" | "closed" | "starting" | "concluded";
}) {
  if ((event.kind ?? "match") !== "training") {
    return false;
  }

  const registrationEnd = new Date(event.registrationEnd).getTime();
  return event.status === "starting" && Number.isFinite(registrationEnd) && Date.now() < registrationEnd;
}

function canAcceptSignups(event: {
  kind?: "match" | "training";
  registrationEnd: string;
  status?: "registration" | "closed" | "starting" | "concluded";
}) {
  return event.status === "registration" || isTrainingRegistrationStillOpen(event);
}

function resolveCreateForumChannel(event: {
  kind?: "match" | "training";
  createForumChannel?: boolean;
}) {
  if (typeof event.createForumChannel === "boolean") {
    return event.createForumChannel;
  }

  return (event.kind ?? "match") === "match";
}

function normalizeEventRecord<T extends {
  _id: unknown;
  registrationEnd: string;
  meetingStart: string;
  gameEnd: string;
  kind?: "match" | "training";
  thumbnailUrl?: string;
  meetingChannelId?: string;
  requiredRoleIds?: string[];
  rewardRoleIds?: string[];
  createForumChannel?: boolean;
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
  matchStatsId?: Id<"matchStats">;
  attendanceReminderLog?: Array<{ userId: string; offsetHours: number; sentAt: string }>;
  participants?: ParticipantRecord[];
  signUps?: Array<{ userId: string; group?: string | null }>;
  scoreAppliedAt?: string;
  scoreResolution?: "applied" | "skipped";
  absenceNotices?: EventNoticeRecord[];
  createdAt?: string;
  updatedAt?: string;
}>(event: T) {
  const status = event.status ?? deriveEventStatus(event);
  const timestamp = event.updatedAt ?? event.createdAt ?? new Date().toISOString();
  const participants = normalizeParticipants(event.participants, event.signUps);
  const matchStatsId = event.matchStatsId;

  return {
    ...event,
    kind: event.kind ?? "match",
    thumbnailUrl: event.thumbnailUrl,
    meetingChannelId: event.meetingChannelId,
    requiredRoleIds: normalizeOptionalArray(event.requiredRoleIds),
    rewardRoleIds: normalizeOptionalArray(event.rewardRoleIds),
    createForumChannel: resolveCreateForumChannel(event),
    status,
    statusUpdatedAt: event.statusUpdatedAt ?? timestamp,
    concludedAt: event.concludedAt,
    eventResult: event.eventResult,
    matchStatsId,
    matchId: matchStatsId,
    attendanceReminderLog: normalizeOptionalArray(event.attendanceReminderLog),
    participants,
    signUps: participantsToSignUps(participants),
    scoreAppliedAt: event.scoreAppliedAt,
    scoreResolution: event.scoreResolution,
    absenceNotices: normalizeOptionalArray(event.absenceNotices),
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
  const meetingCountdownStart = new Date(event.meetingStart).getTime() - 24 * 60 * 60 * 1000;
  const startingAt = Number.isFinite(registrationEnd)
    ? Math.max(registrationEnd, meetingCountdownStart)
    : meetingCountdownStart;
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

function isEventCancelledBeforeMeeting(event: ReturnType<typeof normalizeEventRecord>) {
  const concludedAt = event.concludedAt ? new Date(event.concludedAt).getTime() : NaN;
  const meetingStart = new Date(event.meetingStart).getTime();
  return Number.isFinite(concludedAt) && Number.isFinite(meetingStart) && concludedAt < meetingStart;
}

function getReserveAttendance(
  roster: { reserveAttendances?: ReserveAttendanceRecord[] } | null,
  userId: string,
) {
  return normalizeOptionalArray(roster?.reserveAttendances).find((entry) => entry.userId === userId);
}

function buildRosterLookup(roster: {
  squads: Array<{ players: Array<{ id?: string; ack: boolean; confirmed?: boolean }> }>;
  reservePlayerIds: string[];
  reserveAttendances?: ReserveAttendanceRecord[];
} | null) {
  const rosteredUserIds = new Set<string>();
  const confirmedRosteredUserIds = new Set<string>();
  const reserveUserIds = new Set<string>(roster?.reservePlayerIds ?? []);
  const confirmedReserveUserIds = new Set<string>();

  for (const squad of roster?.squads ?? []) {
    for (const player of squad.players) {
      if (!player.id) continue;
      rosteredUserIds.add(player.id);
      if (player.confirmed) {
        confirmedRosteredUserIds.add(player.id);
      }
    }
  }

  for (const attendance of roster?.reserveAttendances ?? []) {
    if (attendance.confirmed) {
      confirmedReserveUserIds.add(attendance.userId);
    }
  }

  return {
    rosteredUserIds,
    confirmedRosteredUserIds,
    reserveUserIds,
    confirmedReserveUserIds,
  };
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
  if (normalizedEvent.scoreResolution || normalizedEvent.status !== "concluded") {
    return false;
  }

  if (isEventCancelledBeforeMeeting(normalizedEvent)) {
    await ctx.db.patch(eventId, {
      scoreResolution: "skipped",
      updatedAt: new Date().toISOString(),
    });
    return false;
  }

  const config = await ctx.db
    .query("discordConfigs")
    .withIndex("guildId", (q) => q.eq("guildId", normalizedEvent.guildId))
    .unique();
  const scoreSettings = config?.membershipSettings?.rosterScoreSettings ?? DEFAULT_ROSTER_SCORE_SETTINGS;
  const assignments = await ctx.db
    .query("userAssignments")
    .withIndex("serverId", (q) => q.eq("serverId", normalizedEvent.guildId))
    .collect();
  const roster = await ctx.db
    .query("rosters")
    .withIndex("eventId", (q) => q.eq("eventId", eventId))
    .unique();

  const activeAssignments = assignments.filter((assignment) => !assignment.paused);
  const participantByUserId = new Map(normalizedEvent.participants.map((participant) => [participant.userId, participant]));
  const noticesByUserId = new Map(normalizedEvent.absenceNotices.map((notice) => [notice.userId, notice]));
  const rosterLookup = buildRosterLookup(roster ? {
    squads: roster.squads,
    reservePlayerIds: roster.reservePlayerIds,
    reserveAttendances: (roster as typeof roster & { reserveAttendances?: ReserveAttendanceRecord[] }).reserveAttendances,
  } : null);
  const users = await Promise.all(
    activeAssignments.map((assignment) => getUserByDiscordId(ctx, assignment.userId)),
  );

  for (const user of users) {
    if (!user) continue;
    const userId = getUserDiscordId(user);
    const participant = participantByUserId.get(userId);
    let delta = scoreSettings.noCategory;

    if (participant?.status === "not_attending") {
      delta = scoreSettings.declined;
    } else if (participant?.status === "attending") {
      const hasNotice = noticesByUserId.has(userId);
      const isRostered = rosterLookup.rosteredUserIds.has(userId);
      const isReserve = rosterLookup.reserveUserIds.has(userId) || !isRostered;
      const isConfirmedRoster = rosterLookup.confirmedRosteredUserIds.has(userId);
      const isConfirmedReserve = rosterLookup.confirmedReserveUserIds.has(userId);

      if (isConfirmedRoster) {
        delta = scoreSettings.rosterPresent;
      } else if (isConfirmedReserve) {
        delta = scoreSettings.reservePresent;
      } else if (hasNotice) {
        delta = scoreSettings.excusedAbsence;
      } else if (isRostered) {
        delta = scoreSettings.rosterAbsent;
      } else if (isReserve) {
        delta = scoreSettings.reserveAbsent;
      }
    }

    const scores = {
      ...(user.scores ?? {}),
      [normalizedEvent.guildId]: (user.scores?.[normalizedEvent.guildId] ?? user.score ?? 0) + delta,
    };

    await ctx.db.patch(user._id, {
      score: scores[normalizedEvent.guildId],
      scores,
      updatedAt: new Date().toISOString(),
    });
  }

  await ctx.db.patch(eventId, {
    scoreAppliedAt: new Date().toISOString(),
    scoreResolution: "applied",
    updatedAt: new Date().toISOString(),
  });

  return true;
}

export const upsert = mutation({
  args: {
    secret: v.string(),
    serverId: v.id("guilds"),
    eventId: v.optional(v.id("events")),
    kind: v.optional(v.union(v.literal("match"), v.literal("training"))),
    name: v.string(),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    meetingChannelId: v.optional(v.string()),
    requiredRoleIds: v.optional(v.array(v.string())),
    rewardRoleIds: v.optional(v.array(v.string())),
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
    createForumChannel: v.optional(v.boolean()),
    topicPresetId: v.optional(v.id("topicPresets")),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const guild = await getGuildById(ctx, args.serverId);
    if (!guild) {
      throw new Error("Server not found.");
    }
    const guildDiscordId = getGuildDiscordId(guild);

    const payload = {
      guildId: guildDiscordId,
      kind: args.kind ?? "match",
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      thumbnailUrl: args.thumbnailUrl?.trim() || undefined,
      meetingChannelId: args.meetingChannelId?.trim() || undefined,
      requiredRoleIds: normalizeOptionalArray(args.requiredRoleIds).map((roleId) => roleId.trim()).filter(Boolean),
      rewardRoleIds: normalizeOptionalArray(args.rewardRoleIds).map((roleId) => roleId.trim()).filter(Boolean),
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
      createForumChannel: args.kind === "training" ? false : args.createForumChannel ?? true,
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
        matchStatsId: existing?.matchStatsId,
        attendanceReminderLog: normalizeOptionalArray(existing?.attendanceReminderLog),
        participants: normalizeParticipants(existing?.participants, existing?.signUps),
        signUps: normalizeOptionalArray(existing?.signUps),
        scoreAppliedAt: existing?.scoreAppliedAt,
        scoreResolution: existing?.scoreResolution,
        absenceNotices: normalizeOptionalArray(existing?.absenceNotices),
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
      participants: [],
      signUps: [],
      scoreAppliedAt: undefined,
      scoreResolution: undefined,
      absenceNotices: [],
      eventResult: undefined,
      matchStatsId: undefined,
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

export const findNoticeTarget = query({
  args: {
    guildId: v.string(),
    userId: v.string(),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("events")
      .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
      .collect();

    const normalizedQuery = args.query.trim().toLowerCase();
    const now = Date.now();

    return events
      .map((event) => normalizeEventRecord(event))
      .filter((event) => {
        const meetingStart = new Date(event.meetingStart).getTime();
        const noticeWindowStart = meetingStart - 60 * 60 * 1000;
        const isEligibleTime = Number.isFinite(meetingStart) && now >= noticeWindowStart && now < meetingStart;
        const participant = event.participants.find((entry) => entry.userId === args.userId);
        if (!isEligibleTime || event.status === "concluded" || participant?.status !== "attending") {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return event.name.toLowerCase().includes(normalizedQuery) || String(event._id).toLowerCase().includes(normalizedQuery);
      })
      .map((event) => ({
        id: String(event._id),
        name: event.name,
        meetingStart: event.meetingStart,
      }))
      .slice(0, 5);
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

    if (!canAcceptSignups(normalizedEvent)) {
      throw new Error("Signups are closed for this event.");
    }

    const existing = normalizedEvent.participants.find((participant) => participant.userId === args.userId);
    let participants = normalizedEvent.participants.filter((participant) => participant.userId !== args.userId);
    const normalizedNextGroup = args.group && args.group !== SIGNUP_NOT_ATTENDING ? args.group : null;
    const nextStatus = normalizedNextGroup ? "attending" : "not_attending";
    const existingGroup = existing?.status === "attending" ? (existing.group ?? null) : null;
    const shouldRemoveSignup = Boolean(
      existing &&
      existing.status === nextStatus &&
      existingGroup === normalizedNextGroup,
    );
    if (!shouldRemoveSignup) {
      participants = [...participants, {
        userId: args.userId,
        status: nextStatus,
        group: normalizedNextGroup,
        updatedAt: new Date().toISOString(),
        completed: existing?.completed,
      }];
    }

    const signUps = participantsToSignUps(participants);

    await ctx.db.patch(args.eventId, {
      participants,
      signUps,
      updatedAt: new Date().toISOString(),
    });
    await syncRosterMembershipForUser(ctx, args.eventId, args.userId);

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
        !event.participants ||
        !event.signUps ||
        (nextStatus === "concluded" && !event.scoreResolution) ||
        !event.updatedAt;

      if (!shouldPatch) continue;

      await ctx.db.patch(event._id, {
        status: nextStatus,
        statusUpdatedAt: nextStatus !== event.status ? now : normalizedEvent.statusUpdatedAt,
        concludedAt: nextStatus === "concluded" ? event.concludedAt ?? now : undefined,
        eventResult: event.eventResult,
        matchStatsId: event.matchStatsId,
        attendanceReminderLog: normalizedEvent.attendanceReminderLog,
        participants: normalizedEvent.participants,
        signUps: normalizedEvent.signUps,
        scoreAppliedAt: event.scoreAppliedAt,
        scoreResolution: event.scoreResolution,
        absenceNotices: normalizedEvent.absenceNotices,
        updatedAt: now,
      });

      if (nextStatus === "concluded") {
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

export const upsertNotice = mutation({
  args: {
    secret: v.string(),
    eventId: v.id("events"),
    userId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found.");
    }

    const normalizedEvent = normalizeEventRecord(event);
    const now = Date.now();
    const meetingStart = new Date(normalizedEvent.meetingStart).getTime();
    const noticeWindowStart = meetingStart - 60 * 60 * 1000;

    if (!Number.isFinite(meetingStart) || now < noticeWindowStart || now >= meetingStart) {
      throw new Error("Notice can only be submitted in the final 60 minutes before meeting start.");
    }

    if (normalizedEvent.status === "concluded") {
      throw new Error("This event is already concluded.");
    }

    const participant = normalizedEvent.participants.find((entry) => entry.userId === args.userId);
    if (!participant || participant.status !== "attending") {
      throw new Error("Only attending players can submit a notice.");
    }

    const notices = normalizedEvent.absenceNotices.filter((entry) => entry.userId !== args.userId);
    notices.push({
      userId: args.userId,
      reason: args.reason.trim(),
      createdAt: new Date().toISOString(),
    });

    await ctx.db.patch(args.eventId, {
      absenceNotices: notices,
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
