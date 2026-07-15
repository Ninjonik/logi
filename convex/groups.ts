import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getGuildById, getGuildDiscordId } from "./identity";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

function normalizeDoc<T extends { _id: unknown }>(doc: T) {
  return {
    ...doc,
    id: String(doc._id),
  };
}

export const listForGuild = query({
  args: {
    guildId: v.id("guilds"),
  },
  handler: async (ctx, args) => {
    const guild = await getGuildById(ctx, args.guildId);
    if (!guild) {
      return [];
    }
    const groups = await ctx.db.query("groups").withIndex("guildId", (q) => q.eq("guildId", getGuildDiscordId(guild))).collect();
    return groups.map(normalizeDoc);
  },
});

export const getById = query({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    return group ? normalizeDoc(group) : null;
  },
});

export const upsert = mutation({
  args: {
    secret: v.string(),
    guildId: v.id("guilds"),
    groupId: v.optional(v.id("groups")),
    name: v.string(),
    color: v.string(),
    order: v.number(),
    parentId: v.optional(v.id("groups")),
    description: v.optional(v.string()),
    discordRoleId: v.optional(v.string()),
    discordEmoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Group name is required.");
    }
    const guild = await getGuildById(ctx, args.guildId);
    if (!guild) {
      throw new Error("Server not found.");
    }
    const guildDiscordId = getGuildDiscordId(guild);

    const duplicate = await ctx.db
      .query("groups")
      .withIndex("guildId_name", (q) => q.eq("guildId", guildDiscordId).eq("name", trimmedName))
      .unique();

    if (duplicate && duplicate._id !== args.groupId) {
      throw new Error("A group with this name already exists.");
    }

    const now = new Date().toISOString();

    if (args.groupId) {
      await ctx.db.patch(args.groupId, {
        name: trimmedName,
        color: args.color,
        order: args.order,
        parentId: args.parentId,
        description: args.description,
        discordRoleId: args.discordRoleId?.trim() || undefined,
        discordEmoji: args.discordEmoji?.trim() || undefined,
        updatedAt: now,
      });
      return String(args.groupId);
    }

    const groupId = await ctx.db.insert("groups", {
      guildId: guildDiscordId,
      name: trimmedName,
      color: args.color,
      order: args.order,
      parentId: args.parentId,
      description: args.description,
      discordRoleId: args.discordRoleId?.trim() || undefined,
      discordEmoji: args.discordEmoji?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    return String(groupId);
  },
});

export const remove = mutation({
  args: {
    secret: v.string(),
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found.");
    }

    const assignments = await ctx.db.query("userAssignments").withIndex("serverId", (q) => q.eq("serverId", group.guildId)).collect();
    const affectedAssignments = assignments.filter(
      (assignment) =>
        assignment.primaryGroupId === args.groupId || (assignment.secondaryGroupIds ?? []).some((secondaryGroupId) => secondaryGroupId === args.groupId),
    );

    const now = new Date().toISOString();
    for (const assignment of affectedAssignments) {
      await ctx.db.patch(assignment._id, {
        primaryGroupId: assignment.primaryGroupId === args.groupId ? undefined : assignment.primaryGroupId,
        secondaryGroupIds: (assignment.secondaryGroupIds ?? []).filter((secondaryGroupId) => secondaryGroupId !== args.groupId),
        updatedAt: now,
      });
    }

    await ctx.db.delete(args.groupId);
  },
});
