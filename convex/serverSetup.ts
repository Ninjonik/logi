import { mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";

import { defaultGroupSeeds } from "../src/lib/group-defaults";
import { createHllStarterSquadPreset } from "../src/lib/squad-preset-templates";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

async function clearHelperData(ctx: MutationCtx, guildId: string) {
  const [groups, squadPresets, topicPresets, assignments] = await Promise.all([
    ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", guildId)).collect(),
    ctx.db.query("squadPresets").withIndex("guildId", (q) => q.eq("guildId", guildId)).collect(),
    ctx.db.query("topicPresets").withIndex("guildId", (q) => q.eq("guildId", guildId)).collect(),
    ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", guildId)).collect(),
  ]);

  for (const group of groups) {
    await ctx.db.delete(group._id);
  }

  for (const squadPreset of squadPresets) {
    await ctx.db.delete(squadPreset._id);
  }

  for (const topicPreset of topicPresets) {
    await ctx.db.delete(topicPreset._id);
  }

  const now = new Date().toISOString();
  for (const assignment of assignments) {
    await ctx.db.patch(assignment._id, {
      primaryGroupId: undefined,
      secondaryGroupIds: [],
      updatedAt: now,
    });
  }

  const guild = await ctx.db.query("guilds").withIndex("id", (q) => q.eq("id", guildId)).unique();
  if (guild) {
    await ctx.db.patch(guild._id, {
      members: guild.members.map((member) => ({
        ...member,
        primaryGroup: undefined,
        secondaryGroups: [],
      })),
      updatedAt: now,
    });
  }

  return { ok: true };
}

export const resetHelperDataForGuild = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    return await clearHelperData(ctx, args.guildId);
  },
});

export const initializeDefaultHelperDataForGuild = mutation({
  args: {
    secret: v.string(),
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);
    await clearHelperData(ctx, args.guildId);

    const now = new Date().toISOString();
    const groupMap = new Map<string, string>();
    const rootGroups = defaultGroupSeeds.filter((g) => !g.parentId);
    const subGroups = defaultGroupSeeds.filter((g) => g.parentId);

    for (const group of rootGroups) {
      const groupId = await ctx.db.insert("groups", {
        guildId: args.guildId,
        name: group.name,
        color: group.color,
        order: group.order,
        description: group.description,
        createdAt: now,
        updatedAt: now,
      });
      groupMap.set(group.id, groupId);
    }

    for (const group of subGroups) {
      const groupId = await ctx.db.insert("groups", {
        guildId: args.guildId,
        name: group.name,
        color: group.color,
        order: group.order,
        parentId: group.parentId ? (groupMap.get(group.parentId) as never) : undefined,
        description: group.description,
        createdAt: now,
        updatedAt: now,
      });
      groupMap.set(group.id, groupId);
    }

    await ctx.db.insert("squadPresets", {
      guildId: args.guildId,
      name: "HLL Standard Lineup",
      squads: createHllStarterSquadPreset(),
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true };
  },
});
