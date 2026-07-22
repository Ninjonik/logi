import type { Id } from "../../../convex/_generated/dataModel";
import type { MutationCtx } from "../../../convex/_generated/server";
import { SyncRosterMembershipForEventUseCase } from "@/application/rosters/sync-roster-membership.use-case";
import { systemClock } from "@/domain/shared/clock";

import type { AssignmentCommandRepository, AssignmentRecord, AssignmentRosterSyncPort } from "@/application/assignments/ports";
import { ConvexAssignmentRepository, ConvexEventRepository, ConvexRosterRepository } from "./roster-sync-repositories";

export class ConvexAssignmentCommandRepository implements AssignmentCommandRepository {
  constructor(private readonly ctx: MutationCtx) {}

  async serverExists(serverDiscordId: string): Promise<boolean> {
    const server = await this.ctx.db.query("guilds").withIndex("discordId", (q) => q.eq("discordId", serverDiscordId)).unique()
      ?? await this.ctx.db.query("guilds").withIndex("id", (q) => q.eq("id", serverDiscordId)).unique();
    return Boolean(server);
  }

  async userExists(userId: string): Promise<boolean> {
    const user = await this.ctx.db.query("users").withIndex("discordId", (q) => q.eq("discordId", userId)).unique()
      ?? await this.ctx.db.query("users").withIndex("id", (q) => q.eq("id", userId)).unique();
    return Boolean(user);
  }

  async getById(assignmentId: string): Promise<AssignmentRecord | null> {
    const assignment = await this.ctx.db.get(assignmentId as Id<"userAssignments">);
    return assignment ? this.normalizeAssignment(assignment) : null;
  }

  async getByServerUser(serverDiscordId: string, userId: string): Promise<AssignmentRecord | null> {
    const assignment = await this.ctx.db
      .query("userAssignments")
      .withIndex("serverId_userId", (q) => q.eq("serverId", serverDiscordId).eq("userId", userId))
      .unique();
    return assignment ? this.normalizeAssignment(assignment) : null;
  }

  async listByServer(serverDiscordId: string): Promise<AssignmentRecord[]> {
    const assignments = await this.ctx.db
      .query("userAssignments")
      .withIndex("serverId", (q) => q.eq("serverId", serverDiscordId))
      .collect();
    return assignments.map((assignment) => this.normalizeAssignment(assignment));
  }

  async listByUser(userId: string): Promise<AssignmentRecord[]> {
    const assignments = await this.ctx.db
      .query("userAssignments")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    return assignments.map((assignment) => this.normalizeAssignment(assignment));
  }

  async listGroupNamesByServer(serverDiscordId: string): Promise<Map<string, string>> {
    const groups = await this.ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", serverDiscordId)).collect();
    return new Map(groups.map((group) => [String(group._id), group.name]));
  }

  async save(input: {
    assignmentId?: string;
    userId: string;
    serverId: string;
    type: "member" | "mercenary";
    status: "pending" | "recruit" | "active";
    membershipCategoryId?: string;
    primaryGroupId?: string;
    secondaryGroupIds: string[];
    paused: boolean;
    pausedNote?: string;
    nowIso: string;
  }): Promise<string> {
    const payload = {
      userId: input.userId,
      serverId: input.serverId,
      type: input.type,
      status: input.status,
      membershipCategoryId: input.membershipCategoryId,
      primaryGroupId: input.primaryGroupId ? (input.primaryGroupId as Id<"groups">) : undefined,
      secondaryGroupIds: input.secondaryGroupIds.map((groupId) => groupId as Id<"groups">),
      paused: input.paused,
      pausedNote: input.pausedNote,
      updatedAt: input.nowIso,
    };

    if (input.assignmentId) {
      await this.ctx.db.patch(input.assignmentId as Id<"userAssignments">, payload);
      return input.assignmentId;
    }

    const assignmentId = await this.ctx.db.insert("userAssignments", {
      ...payload,
      createdAt: input.nowIso,
    });
    return String(assignmentId);
  }

  async remove(assignmentId: string): Promise<void> {
    await this.ctx.db.delete(assignmentId as Id<"userAssignments">);
  }

  async updateServerMembership(serverDiscordId: string, patch: {
    memberIds: string[];
    members: Array<{
      id: string;
      primaryGroup?: string;
      secondaryGroups: string[];
      joinedAt: string;
      status: "pending" | "recruit" | "member" | "mercenary";
    }>;
    mercenaryIds: string[];
    updatedAt: string;
  }): Promise<void> {
    const server = await this.ctx.db.query("guilds").withIndex("discordId", (q) => q.eq("discordId", serverDiscordId)).unique()
      ?? await this.ctx.db.query("guilds").withIndex("id", (q) => q.eq("id", serverDiscordId)).unique();
    if (!server) {
      return;
    }

    await this.ctx.db.patch(server._id, patch);
  }

  async updateUserMembership(userId: string, patch: {
    guildId?: string;
    mercenaryGuildIds: string[];
    updatedAt: string;
  }): Promise<void> {
    const user = await this.ctx.db.query("users").withIndex("discordId", (q) => q.eq("discordId", userId)).unique()
      ?? await this.ctx.db.query("users").withIndex("id", (q) => q.eq("id", userId)).unique();
    if (!user) {
      return;
    }

    await this.ctx.db.patch(user._id, patch);
  }

  async listOpenMatchEventIds(serverDiscordId: string, now: Date): Promise<string[]> {
    const events = await this.ctx.db
      .query("events")
      .withIndex("guildId", (q) => q.eq("guildId", serverDiscordId))
      .collect();

    return events
      .filter((event) => {
        const registrationEndAt = new Date(event.registrationEnd).getTime();
        return (event.kind ?? "match") === "match" && !(Number.isFinite(registrationEndAt) && now.getTime() >= registrationEndAt);
      })
      .map((event) => String(event._id));
  }

  async upsertImportedUser(input: {
    userId: string;
    name: string;
    avatar: string;
    nowIso: string;
  }): Promise<"created" | "updated"> {
    const existingUser = await this.ctx.db.query("users").withIndex("discordId", (q) => q.eq("discordId", input.userId)).unique()
      ?? await this.ctx.db.query("users").withIndex("id", (q) => q.eq("id", input.userId)).unique();
    const avatar = input.avatar || existingUser?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";

    if (existingUser) {
      await this.ctx.db.patch(existingUser._id, {
        name: input.name,
        avatar,
        updatedAt: input.nowIso,
      });
      return "updated";
    }

    await this.ctx.db.insert("users", {
      discordId: input.userId,
      id: input.userId,
      name: input.name,
      avatar,
      managedGuildIds: [],
      guildId: undefined,
      mercenaryGuildIds: [],
      isStreamer: false,
      score: 0,
      scores: {},
      performance: undefined,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    });
    return "created";
  }

  private normalizeAssignment(assignment: any): AssignmentRecord {
    return {
      ...assignment,
      id: String(assignment._id),
      primaryGroupId: assignment.primaryGroupId ? String(assignment.primaryGroupId) : undefined,
      secondaryGroupIds: Array.isArray(assignment.secondaryGroupIds) ? assignment.secondaryGroupIds.map((groupId: unknown) => String(groupId)) : [],
    };
  }
}

export class ConvexAssignmentRosterSyncPort implements AssignmentRosterSyncPort {
  constructor(private readonly ctx: MutationCtx) {}

  async syncEvent(eventId: string): Promise<void> {
    const useCase = new SyncRosterMembershipForEventUseCase(
      new ConvexEventRepository(this.ctx),
      new ConvexRosterRepository(this.ctx),
      new ConvexAssignmentRepository(this.ctx),
      systemClock,
    );
    await useCase.execute(eventId);
  }
}
