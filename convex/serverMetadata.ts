import { query } from "./_generated/server";
import { v } from "convex/values";
import { getUserByDiscordId } from "./identity";
import { normalizeAssignmentDoc, normalizeDoc, normalizeUserDoc } from "../src/infrastructure/convex/server-read-model";

export const getAssignmentWithUser = query({
  args: {
    assignmentId: v.id("userAssignments"),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) return null;

    const [user, groups] = await Promise.all([
      getUserByDiscordId(ctx, assignment.userId),
      ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", assignment.serverId)).collect(),
    ]);

    const groupNameById = new Map(groups.map((group) => [String(group._id), group.name]));
    const normalizedAssignment = normalizeAssignmentDoc(assignment, groupNameById);

    return {
      ...normalizedAssignment,
      user: user ? normalizeUserDoc(user) : user,
      userName: user?.name || "Unknown Player",
    };
  },
});

export const getRosterById = query({
  args: {
    rosterId: v.id("rosters"),
  },
  handler: async (ctx, args) => {
    const roster = await ctx.db.get(args.rosterId);
    return roster ? normalizeDoc(roster) : null;
  },
});

export const getSquadPresetById = query({
  args: {
    presetId: v.id("squadPresets"),
  },
  handler: async (ctx, args) => {
    const preset = await ctx.db.get(args.presetId);
    return preset ? normalizeDoc(preset) : null;
  },
});

export const getTopicPresetById = query({
  args: {
    presetId: v.id("topicPresets"),
  },
  handler: async (ctx, args) => {
    const preset = await ctx.db.get(args.presetId);
    return preset ? normalizeDoc(preset) : null;
  },
});
