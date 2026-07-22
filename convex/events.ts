import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { ApplyEventScoreUseCase } from "../src/application/events/apply-event-score.use-case";
import { ConcludeEventUseCase } from "../src/application/events/conclude-event.use-case";
import { ReconcileEventStatusesUseCase } from "../src/application/events/reconcile-event-statuses.use-case";
import { ToggleSignupUseCase } from "../src/application/events/toggle-signup.use-case";
import { UpsertEventUseCase } from "../src/application/events/upsert-event.use-case";
import { UpsertNoticeUseCase } from "../src/application/events/upsert-notice.use-case";
import { findEligibleNoticeTargets } from "../src/domain/events/notice-policy";
import { normalizeEventRecord } from "../src/domain/events/normalization";
import { systemClock } from "../src/domain/shared/clock";
import { ConvexEventCommandRepository, ConvexEventScoreRepository, DelegatingEventScorePort } from "../src/infrastructure/convex/event-command-repositories";
import { ConvexEventWorkflowRepository, ConvexEventWorkflowSyncPort } from "../src/infrastructure/convex/event-workflow-repositories";
import { DEFAULT_ROSTER_SCORE_SETTINGS } from "./guilds";
import { getGuildById, getGuildDiscordId } from "./identity";

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

async function applyScoreToEventSignups(
  ctx: MutationCtx,
  eventId: Id<"events">,
) {
  return await new ApplyEventScoreUseCase(
    new ConvexEventScoreRepository(ctx, DEFAULT_ROSTER_SCORE_SETTINGS),
  ).execute(String(eventId));
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
    const useCase = new UpsertEventUseCase(
      new ConvexEventCommandRepository(ctx),
      new DelegatingEventScorePort((eventId) => applyScoreToEventSignups(ctx, eventId as Id<"events">).then(() => undefined)),
      systemClock,
    );
    return await useCase.execute({
      eventId: args.eventId ? String(args.eventId) : undefined,
      guildId: guildDiscordId,
      kind: args.kind,
      name: args.name,
      description: args.description,
      thumbnailUrl: args.thumbnailUrl,
      meetingChannelId: args.meetingChannelId,
      requiredRoleIds: args.requiredRoleIds,
      rewardRoleIds: args.rewardRoleIds,
      server: args.server,
      serverPassword: args.serverPassword,
      side: args.side,
      map: args.map,
      cap: args.cap,
      notes: args.notes,
      registrationEnd: args.registrationEnd,
      meetingStart: args.meetingStart,
      gameStart: args.gameStart,
      gameEnd: args.gameEnd,
      pingClan: args.pingClan,
      createForumChannel: args.createForumChannel,
      topicPresetId: args.topicPresetId ? String(args.topicPresetId) : undefined,
    });
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

    return findEligibleNoticeTargets({
      events: events.map((event) => {
        const normalized = normalizeEventRecord(event);
        return {
          id: String(event._id),
          name: event.name,
          meetingStart: normalized.meetingStart,
          status: normalized.status,
          participants: normalized.participants,
        };
      }),
      userId: args.userId,
      query: args.query,
      now: new Date(),
    }).map((event) => ({
      id: event.id,
      name: event.name,
      meetingStart: event.meetingStart,
    }));
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
    const useCase = new ToggleSignupUseCase(
      new ConvexEventWorkflowRepository(ctx),
      new ConvexEventWorkflowSyncPort(ctx),
      systemClock,
    );
    return await useCase.execute({
      eventId: String(args.eventId),
      userId: args.userId,
      group: args.group,
    });
  },
});

export const reconcileStatuses = mutation({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const useCase = new ReconcileEventStatusesUseCase(
      new ConvexEventCommandRepository(ctx),
      new DelegatingEventScorePort((eventId) => applyScoreToEventSignups(ctx, eventId as Id<"events">).then(() => undefined)),
      systemClock,
    );
    return await useCase.execute();
  },
});

export const conclude = mutation({
  args: {
    secret: v.string(),
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const useCase = new ConcludeEventUseCase(
      new ConvexEventCommandRepository(ctx),
      new DelegatingEventScorePort((eventId) => applyScoreToEventSignups(ctx, eventId as Id<"events">).then(() => undefined)),
      systemClock,
    );
    return await useCase.execute(String(args.eventId));
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
    const useCase = new UpsertNoticeUseCase(
      new ConvexEventWorkflowRepository(ctx),
      systemClock,
    );
    return await useCase.execute({
      eventId: String(args.eventId),
      userId: args.userId,
      reason: args.reason,
    });
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
