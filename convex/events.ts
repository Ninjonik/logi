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
import { normalizeEventRecord } from "../src/domain/events/normalization";
import { systemClock } from "../src/domain/shared/clock";
import { ConvexEventCommandRepository, ConvexEventScoreRepository, DelegatingEventScorePort } from "../src/infrastructure/convex/event-command-repositories";
import { ConvexEventWorkflowRepository, ConvexEventWorkflowSyncPort } from "../src/infrastructure/convex/event-workflow-repositories";
import {
  handleAppendAttendanceReminderLog,
  handleConcludeEvent,
  handleFindNoticeTarget,
  handleReconcileStatuses,
  handleSetEventResult,
  handleToggleSignup,
  handleUpsertEvent,
  handleUpsertNotice,
} from "../src/infrastructure/convex/event-handlers";
import { DEFAULT_ROSTER_SCORE_SETTINGS } from "./guilds";
import { getGuildById, getGuildDiscordId } from "./identity";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

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
    return await handleUpsertEvent({
      secret: args.secret,
      expectedSecret: INTERNAL_AUTH_SECRET,
      args: {
        ...args,
        serverId: String(args.serverId),
        eventId: args.eventId ? String(args.eventId) : undefined,
        topicPresetId: args.topicPresetId ? String(args.topicPresetId) : undefined,
      },
      getGuildById: async (serverId) => await getGuildById(ctx, serverId),
      getGuildDiscordId,
      createUseCase: () => new UpsertEventUseCase(
        new ConvexEventCommandRepository(ctx),
        new DelegatingEventScorePort((eventId) => applyScoreToEventSignups(ctx, eventId as Id<"events">).then(() => undefined)),
        systemClock,
      ),
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

    return handleFindNoticeTarget({
      events,
      userId: args.userId,
      query: args.query,
      now: new Date(),
    });
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
    return await handleToggleSignup({
      secret: args.secret,
      expectedSecret: INTERNAL_AUTH_SECRET,
      args: {
      eventId: String(args.eventId),
      userId: args.userId,
      group: args.group,
      },
      createUseCase: () => new ToggleSignupUseCase(
        new ConvexEventWorkflowRepository(ctx),
        new ConvexEventWorkflowSyncPort(ctx),
        systemClock,
      ),
    });
  },
});

export const reconcileStatuses = mutation({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    return await handleReconcileStatuses({
      secret: args.secret,
      expectedSecret: INTERNAL_AUTH_SECRET,
      createUseCase: () => new ReconcileEventStatusesUseCase(
        new ConvexEventCommandRepository(ctx),
        new DelegatingEventScorePort((eventId) => applyScoreToEventSignups(ctx, eventId as Id<"events">).then(() => undefined)),
        systemClock,
      ),
    });
  },
});

export const conclude = mutation({
  args: {
    secret: v.string(),
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    return await handleConcludeEvent({
      secret: args.secret,
      expectedSecret: INTERNAL_AUTH_SECRET,
      eventId: String(args.eventId),
      createUseCase: () => new ConcludeEventUseCase(
        new ConvexEventCommandRepository(ctx),
        new DelegatingEventScorePort((eventId) => applyScoreToEventSignups(ctx, eventId as Id<"events">).then(() => undefined)),
        systemClock,
      ),
    });
  },
});

export const appendAttendanceReminderLog = mutation({
  args: {
    secret: v.string(),
    eventId: v.id("events"),
    reminders: v.array(attendanceReminder),
  },
  handler: async (ctx, args) => {
    return await handleAppendAttendanceReminderLog({
      secret: args.secret,
      expectedSecret: INTERNAL_AUTH_SECRET,
      eventId: String(args.eventId),
      reminders: args.reminders,
      getEventById: async (eventId) => await ctx.db.get(eventId as Id<"events">),
      patchEvent: async (eventId, patch) => await ctx.db.patch(eventId as Id<"events">, patch),
    });
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
    return await handleUpsertNotice({
      secret: args.secret,
      expectedSecret: INTERNAL_AUTH_SECRET,
      args: {
        eventId: String(args.eventId),
        userId: args.userId,
        reason: args.reason,
      },
      createUseCase: () => new UpsertNoticeUseCase(
        new ConvexEventWorkflowRepository(ctx),
        systemClock,
      ),
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
    return await handleSetEventResult({
      secret: args.secret,
      expectedSecret: INTERNAL_AUTH_SECRET,
      eventId: String(args.eventId),
      eventResult: args.eventResult,
      getEventById: async (eventId) => await ctx.db.get(eventId as Id<"events">),
      patchEvent: async (eventId, patch) => await ctx.db.patch(eventId as Id<"events">, patch),
    });
  },
});
