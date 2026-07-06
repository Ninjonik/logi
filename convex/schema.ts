import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const users = defineTable({
  id: v.string(),
  name: v.string(),
  steamId: v.optional(v.string()),
  avatar: v.string(),
  managedGuildIds: v.array(v.string()),
  guildId: v.optional(v.string()),
  mercenaryGuildIds: v.array(v.string()),
  isStreamer: v.boolean(),
  score: v.number(),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index("id", ["id"]);

const guildMember = v.object({
  id: v.string(),
  group: v.string(),
  joinedAt: v.optional(v.string()),
});

const topic = v.object({
  title: v.string(),
  body: v.optional(v.string()),
  attachments: v.array(v.string()),
});

const squadRole = v.object({
  name: v.string(),
  color: v.string(),
  icon: v.string(),
  count: v.number(),
  note: v.optional(v.string()),
});

const squadPresetSquad = v.object({
  name: v.string(),
  group: v.string(),
  order: v.number(),
  color: v.string(),
  roles: v.array(squadRole),
});

const signUp = v.object({
  userId: v.string(),
  group: v.optional(v.union(v.string(), v.null())),
});

const rosterPlayer = v.object({
  id: v.optional(v.string()),
  ack: v.boolean(),
  note: v.optional(v.string()),
});

const rosterSquad = v.object({
  name: v.string(),
  group: v.string(),
  order: v.number(),
  color: v.string(),
  players: v.array(rosterPlayer),
});

export default defineSchema({
  users,
  guilds: defineTable({
    id: v.string(),
    name: v.string(),
    avatar: v.string(),
    description: v.optional(v.string()),
    adminIds: v.array(v.string()),
    memberIds: v.array(v.string()),
    members: v.array(guildMember),
    mercenaryIds: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("id", ["id"]),
  groups: defineTable({
    name: v.string(),
    roleId: v.string(),
    description: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("roleId", ["roleId"]),
  events: defineTable({
    guildId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    server: v.optional(v.string()),
    serverPassword: v.optional(v.string()),
    side: v.optional(v.string()),
    map: v.optional(v.string()),
    cap: v.optional(v.string()),
    notes: v.optional(v.string()),
    registrationEnd: v.string(),
    meetingStart: v.string(),
    gameStart: v.string(),
    gameEnd: v.string(),
    pingClan: v.boolean(),
    topicPresetId: v.optional(v.id("topicPresets")),
    signUps: v.array(signUp),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("guildId", ["guildId"]),
  topicPresets: defineTable({
    guildId: v.string(),
    name: v.string(),
    side: v.optional(v.string()),
    map: v.optional(v.string()),
    cap: v.optional(v.string()),
    notes: v.optional(v.string()),
    topics: v.array(topic),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("guildId", ["guildId"]),
  squadPresets: defineTable({
    guildId: v.string(),
    name: v.string(),
    squads: v.array(squadPresetSquad),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("guildId", ["guildId"]),
  rosters: defineTable({
    eventId: v.id("events"),
    squadPresetId: v.optional(v.id("squadPresets")),
    squads: v.array(rosterSquad),
    reservePlayerIds: v.array(v.string()),
    streamerId: v.optional(v.string()),
    published: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("eventId", ["eventId"]),
});
