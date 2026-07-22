import { query } from "./_generated/server";
import { v } from "convex/values";
import { getUserByDiscordId } from "./identity";
import { normalizeUserDoc } from "../src/infrastructure/convex/server-read-model";

export const getUsersByIds = query({
  args: {
    userIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const uniqueIds = [...new Set(args.userIds)];
    const users = await Promise.all(uniqueIds.map((userId) => getUserByDiscordId(ctx, userId)));

    return users
      .filter((user): user is NonNullable<typeof user> => Boolean(user))
      .map((user) => normalizeUserDoc(user));
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    return (await ctx.db.query("users").collect()).map((user) => normalizeUserDoc(user));
  },
});
