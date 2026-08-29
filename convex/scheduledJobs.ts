import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { isExpiredScheduledJobClaim, shouldDiscardScheduledJob } from "../src/domain/events/scheduled-job-policy";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";
function assertSecret(secret: string) { if (secret !== INTERNAL_AUTH_SECRET) throw new Error("Unauthorized."); }

export const claimDue = mutation({
  args: { secret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const now = new Date();
    const nowIso = now.toISOString();
    const limit = Math.max(1, Math.min(args.limit ?? 25, 100));
    // Inspect a larger page so stale rows cannot starve an event whose deadline is due now.
    const candidates = await ctx.db.query("eventScheduleJobs")
      .withIndex("status_dueAt", (q) => q.eq("status", "pending").lte("dueAt", nowIso))
      .take(500);
    const claimed: Array<{ id: string; eventId: string; kind: "close-registration" | "start-event" | "conclude-event" | "attendance-reminder" }> = [];

    for (const job of candidates) {
      const event = await ctx.db.get(job.eventId);
      if (!event || shouldDiscardScheduledJob({ eventStatus: event.status, gameEnd: event.gameEnd, now })) {
        await ctx.db.delete(job._id);
        continue;
      }
      if (claimed.length >= limit) continue;
      await ctx.db.patch(job._id, { status: "processing", attempts: job.attempts + 1, claimedAt: nowIso, updatedAt: nowIso });
      claimed.push({ id: String(job._id), eventId: String(job.eventId), kind: job.kind });
    }

    return claimed;
  },
});

export const complete = mutation({
  args: { secret: v.string(), jobId: v.id("eventScheduleJobs") },
  handler: async (ctx, args) => { assertSecret(args.secret); await ctx.db.delete(args.jobId); },
});

export const release = mutation({
  args: { secret: v.string(), jobId: v.id("eventScheduleJobs") },
  handler: async (ctx, args) => { assertSecret(args.secret); await ctx.db.patch(args.jobId, { status: "pending", claimedAt: undefined, updatedAt: new Date().toISOString() }); },
});

// Called on bot startup. It removes legacy jobs that can never do useful work
// and returns jobs abandoned by a crash to the pending queue.
export const recoverQueue = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const now = new Date();
    const nowIso = now.toISOString();
    const jobs = await ctx.db.query("eventScheduleJobs").collect();
    let removed = 0;
    let released = 0;

    for (const job of jobs) {
      const event = await ctx.db.get(job.eventId);
      if (!event || shouldDiscardScheduledJob({ eventStatus: event.status, gameEnd: event.gameEnd, now })) {
        await ctx.db.delete(job._id);
        removed += 1;
      } else if (job.status === "processing" && isExpiredScheduledJobClaim(job.claimedAt, now)) {
        await ctx.db.patch(job._id, { status: "pending", claimedAt: undefined, updatedAt: nowIso });
        released += 1;
      }
    }

    return { removed, released };
  },
});

// One-time-on-bot-start safety net for events created before durable jobs existed.
export const backfillMissing = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const now = new Date().toISOString();
    const events = await ctx.db.query("events").collect();
    let created = 0;
    for (const event of events) {
      const historical = new Date(event.gameEnd).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (historical) continue;
      const existing = await ctx.db.query("eventScheduleJobs").withIndex("eventId", (q) => q.eq("eventId", event._id)).first();
      if (existing) continue;
      const startAtMs = Math.max(new Date(event.registrationEnd).getTime(), new Date(event.meetingStart).getTime() - 24 * 60 * 60 * 1000);
      const deadlines = [["close-registration", event.registrationEnd], ["start-event", new Date(startAtMs).toISOString()], ["conclude-event", event.gameEnd], ...[24, 18, 12, 6].map((hours) => ["attendance-reminder", new Date(new Date(event.meetingStart).getTime() - hours * 60 * 60 * 1000).toISOString()])] as const;
      for (const [kind, dueAt] of deadlines) {
        if (!Number.isFinite(new Date(dueAt).getTime()) || new Date(dueAt).getTime() <= Date.now()) continue;
        await ctx.db.insert("eventScheduleJobs", { eventId: event._id, kind: kind as "close-registration" | "start-event" | "conclude-event" | "attendance-reminder", dueAt, status: "pending", attempts: 0, createdAt: now, updatedAt: now });
        created += 1;
      }
    }
    return { created };
  },
});
