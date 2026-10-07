import { matchesGameScope } from "../src/domain/games/game";
import type { MutationCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { mutation } from "./integrationMutation";
import { v } from "convex/values";

import {
  ConvexAssignmentCommandRepository,
  ConvexAssignmentRosterSyncPort,
} from "../src/infrastructure/convex/assignment-command-repositories";
import { rebuildMembershipState as rebuildAssignmentMembershipState } from "../src/application/assignments/rebuild-membership";
import { ImportDiscordMembersUseCase } from "../src/application/assignments/import-discord-members.use-case";
import { UpsertAssignmentUseCase } from "../src/application/assignments/upsert-assignment.use-case";
import { RemoveAssignmentUseCase } from "../src/application/assignments/remove-assignment.use-case";
import { validateAssignmentGroupIds } from "../src/domain/assignments/policy";
import { getGuildById, getGuildDiscordId } from "./identity";
import { systemClock } from "../src/domain/shared/clock";
import { enqueueManagedRoles, roleActorValidator } from "./memberRoleOperations";
import type { Doc, Id } from "./_generated/dataModel";
import type { RoleActor } from "../src/domain/membership/managed-roles";
import { resolveGameScope } from "../src/domain/games/game";
import { internalAuthSecret } from "./discord_shared";

async function queueRoleChange(ctx: MutationCtx, actor: RoleActor | undefined, before: Doc<"userAssignments"> | null, after: Doc<"userAssignments"> | null) {
  if (!actor) return;
  const source = after ?? before;
  if (!source) return;
  if (before && after && (before.userId !== after.userId || before.serverId !== after.serverId || resolveGameScope(before.gameId) !== resolveGameScope(after.gameId))) {
    throw new Error("Managed assignment identity cannot change.");
  }
  await enqueueManagedRoles(ctx, { guildId: source.serverId, gameId: resolveGameScope(source.gameId), userId: source.userId, actor, before });
}

type AssignmentType = "member" | "reserve_member" | "mercenary";
type AssignmentStatus = "pending" | "recruit" | "active";

function assertInternalSecret(secret: string) {
  if (secret !== internalAuthSecret()) {
    throw new Error("Unauthorized.");
  }
}

function normalizeAssignment<T extends { _id: unknown }>(assignment: T) {
  return {
    ...assignment,
    id: String(assignment._id),
    secondaryGroupIds:
      "secondaryGroupIds" in assignment &&
      Array.isArray(assignment.secondaryGroupIds)
        ? assignment.secondaryGroupIds
        : [],
  };
}

async function rebuildMembershipState(
  ctx: MutationCtx,
  serverDiscordId: string,
  userIds: string[]
) {
  await rebuildAssignmentMembershipState(
    new ConvexAssignmentCommandRepository(ctx),
    serverDiscordId,
    userIds,
    new Date()
  );
}

async function syncOpenRostersForServer(
  ctx: MutationCtx,
  serverDiscordId: string
) {
  const repository = new ConvexAssignmentCommandRepository(ctx);
  const rosterSync = new ConvexAssignmentRosterSyncPort(ctx);
  const eventIds = await repository.listOpenMatchEventIds(
    serverDiscordId,
    new Date()
  );

  for (const eventId of eventIds) {
    await rosterSync.syncEvent(eventId);
  }
}

export const listForServer = query({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
    },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
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
    secret: v.string(),
    assignmentId: v.id("userAssignments"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const assignment = await ctx.db.get(args.assignmentId);
    return assignment ? normalizeAssignment(assignment) : null;
  },
});

export const getForServerUser = query({
  args: {
    secret: v.string(),
    serverDiscordId: v.string(),
    userId: v.string(),
    gameId: v.optional(
      v.union(
        v.literal("hell_let_loose"),
        v.literal("hell_let_loose_vietnam"),
        v.literal("wardogs")
      )
    ),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const assignments = await ctx.db
      .query("userAssignments")
      .withIndex("serverId_userId", (q) =>
        q.eq("serverId", args.serverDiscordId).eq("userId", args.userId)
      )
      .collect();
    const assignment = assignments.find((candidate) =>
      matchesGameScope(candidate.gameId, args.gameId)
    );

    return assignment ? normalizeAssignment(assignment) : null;
  },
});

export const upsert = mutation({
  args: {
    secret: v.string(),
    roleActor: v.optional(roleActorValidator),
    serverId: v.id("guilds"),
    assignmentId: v.optional(v.id("userAssignments")),
    gameId: v.optional(
      v.union(
        v.literal("hell_let_loose"),
        v.literal("hell_let_loose_vietnam"),
        v.literal("wardogs")
      )
    ),
    userId: v.string(),
    type: v.union(
      v.literal("member"),
      v.literal("reserve_member"),
      v.literal("mercenary")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("recruit"),
      v.literal("active")
    ),
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
      systemClock
    );
    const previous = args.assignmentId ? await ctx.db.get(args.assignmentId) : null;
    // An assignment ID from one clan must never edit another clan's record.
    if (previous && previous.serverId !== serverDiscordId) {
      throw new Error("Assignment guild mismatch.");
    }
    const before = previous ? { ...previous } : null;
    const result = await useCase.execute({
      userId: args.userId,
      serverDiscordId,
      gameId: args.gameId,
      assignmentId: args.assignmentId ? String(args.assignmentId) : undefined,
      type: args.type,
      status: args.status,
      membershipCategoryId: args.membershipCategoryId,
      primaryGroupId: args.primaryGroupId
        ? String(args.primaryGroupId)
        : undefined,
      secondaryGroupIds: args.secondaryGroupIds.map((groupId) =>
        String(groupId)
      ),
      paused: args.paused,
      pausedNote: args.pausedNote,
    });
    await queueRoleChange(ctx, args.roleActor, before, await ctx.db.get(result as Id<"userAssignments">));
    return result;
  },
});

export const upsertByServerDiscordId = mutation({
  args: {
    secret: v.string(),
    roleActor: v.optional(roleActorValidator),
    serverDiscordId: v.string(),
    assignmentId: v.optional(v.id("userAssignments")),
    gameId: v.optional(
      v.union(
        v.literal("hell_let_loose"),
        v.literal("hell_let_loose_vietnam"),
        v.literal("wardogs")
      )
    ),
    userId: v.string(),
    type: v.union(
      v.literal("member"),
      v.literal("reserve_member"),
      v.literal("mercenary")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("recruit"),
      v.literal("active")
    ),
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
      systemClock
    );
    const previous = args.assignmentId ? await ctx.db.get(args.assignmentId) : null;
    const before = previous ? { ...previous } : null;
    const result = await useCase.execute({
      userId: args.userId,
      serverDiscordId: args.serverDiscordId,
      gameId: args.gameId,
      assignmentId: args.assignmentId ? String(args.assignmentId) : undefined,
      type: args.type,
      status: args.status,
      membershipCategoryId: args.membershipCategoryId,
      primaryGroupId: args.primaryGroupId
        ? String(args.primaryGroupId)
        : undefined,
      secondaryGroupIds: args.secondaryGroupIds.map((groupId) =>
        String(groupId)
      ),
      paused: args.paused,
      pausedNote: args.pausedNote,
    });
    await queueRoleChange(ctx, args.roleActor, before, await ctx.db.get(result as Id<"userAssignments">));
    return result;
  },
});

export const remove = mutation({
  args: {
    secret: v.string(),
    assignmentId: v.id("userAssignments"),
    roleActor: v.optional(roleActorValidator),
    roleGuildId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    const useCase = new RemoveAssignmentUseCase(
      new ConvexAssignmentCommandRepository(ctx),
      new ConvexAssignmentRosterSyncPort(ctx),
      systemClock
    );
    const before = await ctx.db.get(args.assignmentId);
    if (args.roleActor && (!before || before.serverId !== args.roleGuildId)) throw new Error("Assignment guild mismatch.");
    const result = await useCase.execute(String(args.assignmentId));
    await queueRoleChange(ctx, args.roleActor, before, null);
    return result;
  },
});

export const importDiscordMembers = mutation({
  args: {
    secret: v.string(),
    serverId: v.id("guilds"),
    gameId: v.union(
      v.literal("hell_let_loose"),
      v.literal("hell_let_loose_vietnam"),
      v.literal("wardogs")
    ),
    assignmentType: v.union(
      v.literal("member"),
      v.literal("reserve_member"),
      v.literal("mercenary")
    ),
    status: v.union(v.literal("recruit"), v.literal("active")),
    members: v.array(
      v.object({
        userId: v.string(),
        name: v.string(),
        avatar: v.string(),
        nickname: v.optional(v.string()),
        secondaryGroupIds: v.array(v.id("groups")),
      })
    ),
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
      systemClock
    );
    return await useCase.execute({
      serverDiscordId,
      gameId: args.gameId,
      assignmentType: args.assignmentType,
      status: args.status,
      members: args.members.map((member) => ({
        userId: member.userId,
        name: member.name,
        avatar: member.avatar,
        nickname: member.nickname,
        secondaryGroupIds: member.secondaryGroupIds.map((groupId) =>
          String(groupId)
        ),
      })),
    });
  },
});

export const reassignImportedMember = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    targetServerId: v.id("guilds"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const targetServer = await getGuildById(ctx, args.targetServerId);
    const targetServerDiscordId = targetServer
      ? getGuildDiscordId(targetServer)
      : undefined;
    if (!targetServerDiscordId) {
      throw new Error("Target server Discord ID not found.");
    }

    const repository = new ConvexAssignmentCommandRepository(ctx);
    const userExists = await repository.userExists(args.userId);
    if (!userExists) {
      throw new Error("User not found.");
    }

    const now = systemClock.now();
    const existingAssignments = await repository.listByUser(args.userId);
    const affectedServerIds = new Set<string>();

    for (const assignment of existingAssignments) {
      if (
        (assignment.type !== "member" &&
          assignment.type !== "reserve_member") ||
        assignment.serverId === targetServerDiscordId
      ) {
        continue;
      }

      await repository.remove(assignment.id);
      affectedServerIds.add(assignment.serverId);
    }

    const targetAssignment = existingAssignments.find(
      (assignment) => assignment.serverId === targetServerDiscordId
    );
    await repository.save({
      assignmentId: targetAssignment?.id,
      userId: args.userId,
      serverId: targetServerDiscordId,
      type: "member",
      status: "active",
      membershipCategoryId: undefined,
      primaryGroupId: undefined,
      secondaryGroupIds: [],
      paused: false,
      pausedNote: undefined,
      nowIso: now.toISOString(),
    });
    affectedServerIds.add(targetServerDiscordId);

    for (const serverDiscordId of affectedServerIds) {
      await rebuildMembershipState(ctx, serverDiscordId, [args.userId]);
      await syncOpenRostersForServer(ctx, serverDiscordId);
    }

    return {
      userId: args.userId,
      targetServerDiscordId,
      reassigned: true,
    };
  },
});
