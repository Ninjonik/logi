import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserByDiscordId } from "./identity";
import { assertInternalSecret, normalizeConfigDoc, normalizeDoc, normalizeUserDoc } from "./discord-shared";

export const getTicketCategoryContext = query({
  args: { secret: v.string(), guildId: v.string(), categoryId: v.string() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const config = await ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).unique();
    if (!config?.ticketSettings?.enabled) return null;
    const category = config.ticketSettings.categories.find((item) => item.id === args.categoryId);
    if (!category) return null;
    return { config: normalizeConfigDoc(config), category };
  },
});

export const getMembershipCategoryContext = query({
  args: { secret: v.string(), guildId: v.string(), categoryId: v.string() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const config = await ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).unique();
    if (!config?.membershipSettings?.enabled) return null;
    const category = config.membershipSettings.categories.find((item) => item.id === args.categoryId);
    if (!category) return null;
    return { config: normalizeConfigDoc(config), category };
  },
});

export const getMembershipApplicationPrereq = query({
  args: { secret: v.string(), guildId: v.string(), categoryId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const config = await ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).unique();
    if (!config?.membershipSettings?.enabled) return null;
    const category = config.membershipSettings.categories.find((item) => item.id === args.categoryId);
    if (!category) return null;

    const [user, assignment, openApplications] = await Promise.all([
      getUserByDiscordId(ctx, args.userId),
      ctx.db.query("userAssignments").withIndex("serverId_userId", (q) => q.eq("serverId", args.guildId).eq("userId", args.userId)).unique(),
      ctx.db.query("membershipApplicationThreads").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).collect(),
    ]);

    return {
      config: normalizeConfigDoc(config),
      category,
      user: user ? normalizeUserDoc(user) : null,
      assignment: assignment ? normalizeDoc(assignment) : null,
      hasOpenApplication: openApplications.some((application) => application.creatorId === args.userId && application.status === "open"),
    };
  },
});

export const createTicketThread = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    threadId: v.string(),
    parentChannelId: v.string(),
    creatorId: v.string(),
    categoryId: v.string(),
    transcriptMessageId: v.optional(v.string()),
    answers: v.array(v.object({ questionId: v.string(), label: v.string(), value: v.string() })),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const config = await ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).unique();
    if (!config?.ticketSettings?.enabled) throw new Error("Tickets are not enabled.");
    const category = config.ticketSettings.categories.find((item) => item.id === args.categoryId);
    if (!category) throw new Error("Ticket category not found.");
    const nextTicketNumber = (config.ticketCounter ?? 0) + 1;
    const now = new Date().toISOString();
    await ctx.db.patch(config._id, { ticketCounter: nextTicketNumber });
    const threadRecordId = await ctx.db.insert("ticketThreads", {
      guildId: args.guildId,
      threadId: args.threadId,
      parentChannelId: args.parentChannelId,
      creatorId: args.creatorId,
      categoryId: category.id,
      categoryLabel: category.label?.trim() || category.id,
      ticketNumber: nextTicketNumber,
      status: "open",
      transcriptMessageId: args.transcriptMessageId,
      answers: args.answers,
      openedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return {
      ticket: { id: String(threadRecordId), threadId: args.threadId, ticketNumber: nextTicketNumber, categoryId: category.id, categoryLabel: category.label?.trim() || category.id },
      category,
      config: normalizeConfigDoc(config),
    };
  },
});

export const createMembershipApplicationThread = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
    threadId: v.string(),
    parentChannelId: v.string(),
    creatorId: v.string(),
    categoryId: v.string(),
    assignmentType: v.union(v.literal("member"), v.literal("mercenary")),
    assignmentId: v.optional(v.id("userAssignments")),
    transcriptMessageId: v.optional(v.string()),
    answers: v.array(v.object({ questionId: v.string(), label: v.string(), value: v.string() })),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const config = await ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", args.guildId)).unique();
    if (!config?.membershipSettings?.enabled) throw new Error("Membership applications are not enabled.");
    const category = config.membershipSettings.categories.find((item) => item.id === args.categoryId);
    if (!category) throw new Error("Application category not found.");
    const nextApplicationNumber = (config.membershipApplicationCounter ?? 0) + 1;
    const now = new Date().toISOString();
    await ctx.db.patch(config._id, { membershipApplicationCounter: nextApplicationNumber });
    const applicationId = await ctx.db.insert("membershipApplicationThreads", {
      guildId: args.guildId,
      threadId: args.threadId,
      parentChannelId: args.parentChannelId,
      creatorId: args.creatorId,
      categoryId: category.id,
      categoryLabel: category.label?.trim() || category.id,
      assignmentType: args.assignmentType,
      applicationNumber: nextApplicationNumber,
      assignmentId: args.assignmentId,
      transcriptMessageId: args.transcriptMessageId,
      answers: args.answers,
      status: "open",
      openedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return {
      application: { id: String(applicationId), threadId: args.threadId, applicationNumber: nextApplicationNumber, categoryLabel: category.label?.trim() || category.id },
      category,
      config: normalizeConfigDoc(config),
    };
  },
});

export const getTicketThreadContext = query({
  args: { secret: v.string(), threadId: v.string() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const ticket = await ctx.db.query("ticketThreads").withIndex("threadId", (q) => q.eq("threadId", args.threadId)).unique();
    if (!ticket) return null;
    const config = await ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", ticket.guildId)).unique();
    if (!config) return null;
    const category = config.ticketSettings?.categories.find((item) => item.id === ticket.categoryId) ?? null;
    return { config: normalizeConfigDoc(config), ticket: normalizeDoc(ticket), category };
  },
});

export const getMembershipApplicationThreadContext = query({
  args: { secret: v.string(), threadId: v.string() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const application = await ctx.db.query("membershipApplicationThreads").withIndex("threadId", (q) => q.eq("threadId", args.threadId)).unique();
    if (!application) return null;
    const [config, assignment] = await Promise.all([
      ctx.db.query("discordConfigs").withIndex("guildId", (q) => q.eq("guildId", application.guildId)).unique(),
      application.assignmentId ? ctx.db.get(application.assignmentId) : null,
    ]);
    if (!config) return null;
    const category = config.membershipSettings?.categories.find((item) => item.id === application.categoryId) ?? null;
    return { config: normalizeConfigDoc(config), application: normalizeDoc(application), assignment: assignment ? normalizeDoc(assignment) : null, category };
  },
});

export const getMembershipApplicationByAssignment = query({
  args: { secret: v.string(), assignmentId: v.id("userAssignments") },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const applications = await ctx.db.query("membershipApplicationThreads").collect();
    const application = applications.find((item) => item.assignmentId === args.assignmentId) ?? null;
    return application ? normalizeDoc(application) : null;
  },
});

export const closeTicketThread = mutation({
  args: { secret: v.string(), threadId: v.string(), closedByUserId: v.string(), closeReason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const ticket = await ctx.db.query("ticketThreads").withIndex("threadId", (q) => q.eq("threadId", args.threadId)).unique();
    if (!ticket) throw new Error("Ticket not found.");
    const now = new Date().toISOString();
    await ctx.db.patch(ticket._id, {
      status: "closed",
      closedAt: now,
      closedByUserId: args.closedByUserId,
      closeReason: args.closeReason?.trim() || undefined,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const closeMembershipApplicationThread = mutation({
  args: {
    secret: v.string(),
    threadId: v.string(),
    closedByUserId: v.string(),
    closeReason: v.optional(v.string()),
    closeOutcome: v.union(v.literal("denied"), v.literal("pending"), v.literal("recruit"), v.literal("member"), v.literal("mercenary")),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const application = await ctx.db.query("membershipApplicationThreads").withIndex("threadId", (q) => q.eq("threadId", args.threadId)).unique();
    if (!application) throw new Error("Application not found.");
    const now = new Date().toISOString();
    await ctx.db.patch(application._id, {
      status: "closed",
      closeOutcome: args.closeOutcome,
      closedAt: now,
      closedByUserId: args.closedByUserId,
      closeReason: args.closeReason?.trim() || undefined,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const updateTicketTranscriptMessage = mutation({
  args: { secret: v.string(), threadId: v.string(), transcriptMessageId: v.string() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const ticket = await ctx.db.query("ticketThreads").withIndex("threadId", (q) => q.eq("threadId", args.threadId)).unique();
    if (!ticket) throw new Error("Ticket not found.");
    await ctx.db.patch(ticket._id, {
      transcriptMessageId: args.transcriptMessageId,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  },
});

export const updateMembershipApplicationTranscriptMessage = mutation({
  args: { secret: v.string(), threadId: v.string(), transcriptMessageId: v.string() },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const application = await ctx.db.query("membershipApplicationThreads").withIndex("threadId", (q) => q.eq("threadId", args.threadId)).unique();
    if (!application) throw new Error("Application not found.");
    await ctx.db.patch(application._id, {
      transcriptMessageId: args.transcriptMessageId,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  },
});
