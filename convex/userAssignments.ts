import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { rebuildMembershipState as rebuildAssignmentMembershipState } from "../src/application/assignments/rebuild-membership";
import { RemoveAssignmentUseCase } from "../src/application/assignments/remove-assignment.use-case";
import { ImportDiscordMembersUseCase } from "../src/application/assignments/import-discord-members.use-case";
import { UpsertAssignmentUseCase } from "../src/application/assignments/upsert-assignment.use-case";
import { validateAssignmentGroupIds } from "../src/domain/assignments/policy";
import { systemClock } from "../src/domain/shared/clock";
import { ConvexAssignmentCommandRepository, ConvexAssignmentRosterSyncPort } from "../src/infrastructure/convex/assignment-command-repositories";
import { getGuildById, getGuildDiscordId } from "./identity";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

type AssignmentType = "member" | "mercenary";
type AssignmentStatus = "pending" | "recruit" | "active";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

function normalizeAssignment<T extends { _id: unknown }>(assignment: T) {
  return {
    ...assignment,
    id: String(assignment._id),
    secondaryGroupIds: "secondaryGroupIds" in assignment && Array.isArray(assignment.secondaryGroupIds) ? assignment.secondaryGroupIds : [],
  };
}

async function rebuildMembershipState(
  ctx: MutationCtx,
  serverDiscordId: string,
  userIds: string[],
) {
  await rebuildAssignmentMembershipState(
    new ConvexAssignmentCommandRepository(ctx),
    serverDiscordId,
    userIds,
    new Date(),
  );
}

async function syncOpenRostersForServer(ctx: MutationCtx, serverDiscordId: string) {
  const repository = new ConvexAssignmentCommandRepository(ctx);
  const rosterSync = new ConvexAssignmentRosterSyncPort(ctx);
  const eventIds = await repository.listOpenMatchEventIds(serverDiscordId, new Date());

  for (const eventId of eventIds) {
    await rosterSync.syncEvent(eventId);
  }
}

export const listForServer = query({
  args: {
    serverId: v.id("guilds"),
  },
  handler: async (ctx, args) => {
    const server = await getGuildById(ctx, args.serverId);
    if (!server) {
      return [];
    }

    const assignments = await ctx.db
      .query("userAssignments")
      .withIndex("serverId", (q) => q.eq("serverId", getGuildDiscordId(server)))
      .collect();

    return assignments.map(normalizeAssignment);
  },
});

export const getById = query({
  args: {
    assignmentId: v.id("userAssignments"),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.assignmentId);
    return assignment ? normalizeAssignment(assignment) : null;
  },
});

export const getForServerUser = query({
  args: {
    serverDiscordId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db
      .query("userAssignments")
      .withIndex("serverId_userId", (q) => q.eq("serverId", args.serverDiscordId).eq("userId", args.userId))
      .unique();

    return assignment ? normalizeAssignment(assignment) : null;
  },
});

export const upsert = mutation({
  args: {
    secret: v.string(),
    serverId: v.id("guilds"),
    assignmentId: v.optional(v.id("userAssignments")),
    userId: v.string(),
    type: v.union(v.literal("member"), v.literal("mercenary")),
    status: v.union(v.literal("pending"), v.literal("recruit"), v.literal("active")),
    membershipCategoryId: v.optional(v.string()),
    primaryGroupId: v.optional(v.id("groups")),
    secondaryGroupIds: v.array(v.id("groups")),
    paused: v.boolean(),
    pausedNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const server = await getGuildById(ctx, args.serverId);
    const serverDiscordId = server ? getGuildDiscordId(server) : undefined;
    if (!serverDiscordId) {
      throw new Error("Server Discord ID not found.");
    }
    const useCase = new UpsertAssignmentUseCase(
      new ConvexAssignmentCommandRepository(ctx),
      new ConvexAssignmentRosterSyncPort(ctx),
      systemClock,
    );
    return await useCase.execute({
      userId: args.userId,
      serverDiscordId,
      assignmentId: args.assignmentId ? String(args.assignmentId) : undefined,
      type: args.type,
      status: args.status,
      membershipCategoryId: args.membershipCategoryId,
      primaryGroupId: args.primaryGroupId ? String(args.primaryGroupId) : undefined,
      secondaryGroupIds: args.secondaryGroupIds.map((groupId) => String(groupId)),
      paused: args.paused,
      pausedNote: args.pausedNote,
    });
  },
});

export const upsertByServerDiscordId = mutation({
  args: {
    secret: v.string(),
    serverDiscordId: v.string(),
    assignmentId: v.optional(v.id("userAssignments")),
    userId: v.string(),
    type: v.union(v.literal("member"), v.literal("mercenary")),
    status: v.union(v.literal("pending"), v.literal("recruit"), v.literal("active")),
    membershipCategoryId: v.optional(v.string()),
    primaryGroupId: v.optional(v.id("groups")),
    secondaryGroupIds: v.array(v.id("groups")),
    paused: v.boolean(),
    pausedNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const useCase = new UpsertAssignmentUseCase(
      new ConvexAssignmentCommandRepository(ctx),
      new ConvexAssignmentRosterSyncPort(ctx),
      systemClock,
    );
    return await useCase.execute({
      userId: args.userId,
      serverDiscordId: args.serverDiscordId,
      assignmentId: args.assignmentId ? String(args.assignmentId) : undefined,
      type: args.type,
      status: args.status,
      membershipCategoryId: args.membershipCategoryId,
      primaryGroupId: args.primaryGroupId ? String(args.primaryGroupId) : undefined,
      secondaryGroupIds: args.secondaryGroupIds.map((groupId) => String(groupId)),
      paused: args.paused,
      pausedNote: args.pausedNote,
    });
  },
});

export const remove = mutation({
  args: {
    secret: v.string(),
    assignmentId: v.id("userAssignments"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const useCase = new RemoveAssignmentUseCase(
      new ConvexAssignmentCommandRepository(ctx),
      new ConvexAssignmentRosterSyncPort(ctx),
      systemClock,
    );
    return await useCase.execute(String(args.assignmentId));
  },
});

export const importDiscordMembers = mutation({
  args: {
    secret: v.string(),
    serverId: v.id("guilds"),
    assignmentType: v.union(v.literal("member"), v.literal("mercenary")),
    members: v.array(v.object({
      userId: v.string(),
      name: v.string(),
      avatar: v.string(),
      secondaryGroupIds: v.array(v.id("groups")),
    })),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const server = await getGuildById(ctx, args.serverId);
    if (!server) {
      throw new Error("Server not found.");
    }

    const serverDiscordId = getGuildDiscordId(server);
    const useCase = new ImportDiscordMembersUseCase(
      new ConvexAssignmentCommandRepository(ctx),
      new ConvexAssignmentRosterSyncPort(ctx),
      systemClock,
    );
    return await useCase.execute({
      serverDiscordId,
      assignmentType: args.assignmentType,
      members: args.members.map((member) => ({
        userId: member.userId,
        name: member.name,
        avatar: member.avatar,
        secondaryGroupIds: member.secondaryGroupIds.map((groupId) => String(groupId)),
      })),
    });
  },
});
