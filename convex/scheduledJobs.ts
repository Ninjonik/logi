import { mutation } from "./_generated/server";
import { v } from "convex/values";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";
function assertSecret(secret: string) { if (secret !== INTERNAL_AUTH_SECRET) throw new Error("Unauthorized."); }

export const claimDue = mutation({
  args: { secret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const now = new Date().toISOString();
    const jobs = await ctx.db.query("eventScheduleJobs").withIndex("status_dueAt", (q) => q.eq("status", "pending").lte("dueAt", now)).take(Math.max(1, Math.min(args.limit ?? 25, 100)));
    await Promise.all(jobs.map((job) => ctx.db.patch(job._id, { status: "processing", attempts: job.attempts + 1, updatedAt: now })));
    return jobs.map((job) => ({ id: String(job._id), eventId: String(job.eventId), kind: job.kind }));
  },
});

export const complete = mutation({
  args: { secret: v.string(), jobId: v.id("eventScheduleJobs") },
  handler: async (ctx, args) => { assertSecret(args.secret); await ctx.db.delete(args.jobId); },
});

export const release = mutation({
  args: { secret: v.string(), jobId: v.id("eventScheduleJobs") },
  handler: async (ctx, args) => { assertSecret(args.secret); await ctx.db.patch(args.jobId, { status: "pending", updatedAt: new Date().toISOString() }); },
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
      const existing = await ctx.db.query("eventScheduleJobs").withIndex("eventId", (q) => q.eq("eventId", event._id)).first();
      if (existing) continue;
      const startAtMs = Math.max(new Date(event.registrationEnd).getTime(), new Date(event.meetingStart).getTime() - 24 * 60 * 60 * 1000);
      const deadlines = [["close-registration", event.registrationEnd], ["start-event", new Date(startAtMs).toISOString()], ["conclude-event", event.gameEnd], ...[24, 18, 12, 6].map((hours) => ["attendance-reminder", new Date(new Date(event.meetingStart).getTime() - hours * 60 * 60 * 1000).toISOString()])] as const;
      for (const [kind, dueAt] of deadlines) {
        if (!Number.isFinite(new Date(dueAt).getTime())) continue;
        await ctx.db.insert("eventScheduleJobs", { eventId: event._id, kind: kind as "close-registration" | "start-event" | "conclude-event" | "attendance-reminder", dueAt, status: "pending", attempts: 0, createdAt: now, updatedAt: now });
        created += 1;
      }
    }
    return { created };
  },
});
