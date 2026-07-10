import { mutation } from "./_generated/server";
import { v } from "convex/values";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

const topic = v.object({
  id: v.optional(v.string()),
  title: v.string(),
  body: v.optional(v.string()),
  attachments: v.array(v.string()),
});

export const upsert = mutation({
  args: {
    secret: v.string(),
    serverId: v.string(),
    presetId: v.optional(v.id("topicPresets")),
    name: v.string(),
    side: v.optional(v.string()),
    map: v.optional(v.string()),
    cap: v.optional(v.string()),
    notes: v.optional(v.string()),
    topics: v.array(topic),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const guild = await ctx.db.query("guilds").withIndex("id", (q) => q.eq("id", args.serverId)).unique();
    if (!guild) {
      throw new Error("Server not found.");
    }

    const name = args.name.trim();
    if (!name) {
      throw new Error("Preset name is required.");
    }

    const topics = args.topics.map((item) => ({
      id: item.id?.trim() || crypto.randomUUID(),
      title: item.title.trim(),
      body: item.body?.trim() || undefined,
      attachments: item.attachments.map((attachment) => attachment.trim()).filter(Boolean),
    }));

    if (!topics.length || topics.some((item) => !item.title)) {
      throw new Error("Every preset needs at least one named topic.");
    }

    const payload = {
      guildId: args.serverId,
      name,
      side: args.side?.trim() || undefined,
      map: args.map?.trim() || undefined,
      cap: args.cap?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      topics,
      updatedAt: new Date().toISOString(),
    };

    if (args.presetId) {
      const existing = await ctx.db.get(args.presetId);
      if (!existing || existing.guildId !== args.serverId) {
        throw new Error("Topic preset not found.");
      }

      await ctx.db.patch(args.presetId, payload);
      return String(args.presetId);
    }

    const now = new Date().toISOString();
    const presetId = await ctx.db.insert("topicPresets", {
      ...payload,
      createdAt: now,
      updatedAt: now,
    });

    return String(presetId);
  },
});
