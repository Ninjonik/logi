import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const users = defineTable({
  id: v.string(),
  name: v.string(),
  platformIds: v.optional(v.array(v.string())),
  avatar: v.string(),
  managedGuildIds: v.array(v.string()),
  guildId: v.optional(v.string()),
  mercenaryGuildIds: v.array(v.string()),
  isStreamer: v.boolean(),
  score: v.number(),
  performance: v.optional(v.object({
    matchesPlayed: v.number(),
    averages: v.object({
      kills: v.number(),
      killDeathRatio: v.number(),
      deaths: v.number(),
      offense: v.number(),
      defense: v.number(),
      support: v.number(),
    }),
  })),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index("id", ["id"]);

const guildMember = v.object({
  id: v.string(),
  group: v.optional(v.string()),
  primaryGroup: v.optional(v.string()),
  secondaryGroups: v.optional(v.array(v.string())),
  joinedAt: v.optional(v.string()),
});

const topic = v.object({
  id: v.optional(v.string()),
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
  icon: v.string(),
  roles: v.array(squadRole),
});

const signUp = v.object({
  userId: v.string(),
  group: v.optional(v.union(v.string(), v.null())),
});

const eventParticipant = v.object({
  userId: v.string(),
  status: v.union(v.literal("attending"), v.literal("not_attending")),
  group: v.optional(v.union(v.string(), v.null())),
  completed: v.optional(v.union(v.literal("passed"), v.literal("failed"))),
  updatedAt: v.string(),
});

const rosterScoreSettings = v.object({
  noResponse: v.number(),
  declined: v.number(),
  accepted: v.number(),
});

const attendanceReminder = v.object({
  userId: v.string(),
  offsetHours: v.number(),
  sentAt: v.string(),
});

const eventResult = v.object({
  sourceUrl: v.string(),
  mapId: v.string(),
  mapName: v.optional(v.string()),
  endedAt: v.optional(v.string()),
  importedAt: v.string(),
  sideA: v.string(),
  sideB: v.string(),
  outcome: v.union(v.literal("victory"), v.literal("defeat"), v.literal("draw")),
  score: v.object({
    sideA: v.number(),
    sideB: v.number(),
  }),
});

const statBreakdown = v.object({
  infantry: v.optional(v.number()),
  mine: v.optional(v.number()),
  sniper: v.optional(v.number()),
  armor: v.optional(v.number()),
  satchel: v.optional(v.number()),
  grenade: v.optional(v.number()),
  machine_gun: v.optional(v.number()),
  bazooka: v.optional(v.number()),
  artillery: v.optional(v.number()),
  commander: v.optional(v.number()),
});

const matchPlayerTeam = v.object({
  side: v.union(v.literal("axis"), v.literal("allies"), v.literal("unknown")),
  confidence: v.optional(v.union(v.literal("strong"), v.literal("mixed"))),
  ratio: v.optional(v.number()),
});

const matchPlayerStat = v.object({
  id: v.number(),
  player_id: v.string(),
  player: v.string(),
  map_id: v.number(),
  kills: v.number(),
  kills_by_type: v.optional(statBreakdown),
  kills_streak: v.number(),
  deaths: v.number(),
  deaths_by_type: v.optional(statBreakdown),
  deaths_without_kill_streak: v.number(),
  teamkills: v.number(),
  teamkills_streak: v.number(),
  deaths_by_tk: v.number(),
  deaths_by_tk_streak: v.number(),
  nb_vote_started: v.number(),
  nb_voted_yes: v.number(),
  nb_voted_no: v.number(),
  time_seconds: v.number(),
  kills_per_minute: v.number(),
  deaths_per_minute: v.number(),
  kill_death_ratio: v.number(),
  longest_life_secs: v.number(),
  shortest_life_secs: v.number(),
  combat: v.number(),
  offense: v.number(),
  defense: v.number(),
  support: v.number(),
  most_killed: v.record(v.string(), v.number()),
  death_by: v.record(v.string(), v.number()),
  weapons: v.record(v.string(), v.number()),
  death_by_weapons: v.record(v.string(), v.number()),
  team: matchPlayerTeam,
  level: v.number(),
});

const rawMatch = v.object({
  id: v.number(),
  creation_time: v.string(),
  start: v.string(),
  end: v.string(),
  server_number: v.number(),
  map_name: v.string(),
  result: v.object({
    axis: v.number(),
    allied: v.number(),
  }),
  game_layout: v.object({
    requested: v.array(v.union(v.number(), v.null())),
    set: v.array(v.string()),
  }),
  player_stats: v.array(matchPlayerStat),
  map: v.object({
    id: v.string(),
    game_mode: v.string(),
    attackers: v.optional(v.union(v.string(), v.null())),
    environment: v.string(),
    pretty_name: v.string(),
    image_name: v.string(),
    map: v.object({
      id: v.string(),
      name: v.string(),
      tag: v.string(),
      pretty_name: v.string(),
      shortname: v.string(),
      allies: v.object({
        name: v.string(),
        team: v.union(v.literal("axis"), v.literal("allies"), v.literal("unknown")),
      }),
      axis: v.object({
        name: v.string(),
        team: v.union(v.literal("axis"), v.literal("allies"), v.literal("unknown")),
      }),
      orientation: v.string(),
    }),
  }),
});

const rosterPlayer = v.object({
  id: v.optional(v.string()),
  ack: v.boolean(),
  confirmed: v.optional(v.boolean()),
  note: v.optional(v.string()),
  roleName: v.optional(v.string()),
  roleIcon: v.optional(v.string()),
});

const rosterSquad = v.object({
  name: v.string(),
  group: v.string(),
  order: v.number(),
  color: v.string(),
  icon: v.optional(v.string()),
  players: v.array(rosterPlayer),
});

const userAssignments = defineTable({
  userId: v.string(),
  serverId: v.string(),
  type: v.union(v.literal("member"), v.literal("mercenary")),
  primaryGroupId: v.optional(v.id("groups")),
  secondaryGroupIds: v.optional(v.array(v.id("groups"))),
  group: v.optional(v.string()),
  paused: v.boolean(),
  pausedNote: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index("serverId", ["serverId"])
  .index("userId", ["userId"])
  .index("serverId_userId", ["serverId", "userId"]);

export default defineSchema({
  users,
  guilds: defineTable({
    id: v.string(),
    name: v.string(),
    avatar: v.string(),
    description: v.optional(v.string()),
    rosterScoreSettings: v.optional(rosterScoreSettings),
    botInside: v.boolean(),
    adminIds: v.array(v.string()),
    memberIds: v.array(v.string()),
    members: v.array(guildMember),
    mercenaryIds: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("id", ["id"]),
  discordConfigs: defineTable({
    guildId: v.string(),
    timezone: v.string(),
    defaultLanguage: v.union(v.literal("en"), v.literal("cs")),
    announcementsChannelId: v.optional(v.string()),
    forumCategoryId: v.optional(v.string()),
    meetingChannelId: v.optional(v.string()),
    clanRoleId: v.optional(v.string()),
    dashboardAdminRoleId: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("guildId", ["guildId"]),
  groups: defineTable({
    guildId: v.string(),
    name: v.string(),
    color: v.string(),
    order: v.number(),
    parentId: v.optional(v.id("groups")),
    description: v.optional(v.string()),
    discordRoleId: v.optional(v.string()),
    discordEmoji: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("guildId", ["guildId"])
    .index("guildId_name", ["guildId", "name"]),
  events: defineTable({
    guildId: v.string(),
    kind: v.optional(v.union(v.literal("match"), v.literal("training"))),
    name: v.string(),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    meetingChannelId: v.optional(v.string()),
    requiredRoleIds: v.optional(v.array(v.string())),
    rewardRoleIds: v.optional(v.array(v.string())),
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
    status: v.optional(v.union(
      v.literal("registration"),
      v.literal("closed"),
      v.literal("starting"),
      v.literal("concluded"),
    )),
    statusUpdatedAt: v.optional(v.string()),
    concludedAt: v.optional(v.string()),
    eventResult: v.optional(eventResult),
    matchStatsId: v.optional(v.id("matchStats")),
    attendanceReminderLog: v.optional(v.array(attendanceReminder)),
    participants: v.optional(v.array(eventParticipant)),
    signUps: v.optional(v.array(signUp)),
    scoreAppliedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.optional(v.string()),
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
    notAttendingPlayerIds: v.array(v.string()),
    streamerId: v.optional(v.string()),
    published: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("eventId", ["eventId"]),
  discordEventSyncs: defineTable({
    eventId: v.id("events"),
    guildId: v.string(),
    announcementChannelId: v.optional(v.string()),
    announcementMessageId: v.optional(v.string()),
    scheduledEventId: v.optional(v.string()),
    scheduledEventStatus: v.optional(v.union(
      v.literal("scheduled"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("canceled"),
    )),
    forumChannelId: v.optional(v.string()),
    forumThreadId: v.optional(v.string()),
    infoMessageId: v.optional(v.string()),
    topicMessageIds: v.array(v.string()),
    lastSyncedAt: v.optional(v.string()),
    lastEventUpdatedAt: v.optional(v.string()),
    lastRosterUpdatedAt: v.optional(v.string()),
    lastConfigUpdatedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("eventId", ["eventId"])
    .index("guildId", ["guildId"]),
  discordMemberAccess: defineTable({
    guildId: v.string(),
    userId: v.string(),
    roleIds: v.array(v.string()),
    voiceChannelId: v.optional(v.string()),
    isAdmin: v.boolean(),
    hasDashboardAccess: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("guildId", ["guildId"])
    .index("userId", ["userId"])
    .index("guildId_userId", ["guildId", "userId"]),
  userAssignments,
  playerStats: defineTable({
    id: v.string(),
    userId: v.optional(v.string()),
    latestName: v.optional(v.string()),
    updatedAt: v.string(),
    matches: v.record(v.string(), v.object({
      sourceUrl: v.string(),
      importedAt: v.string(),
      endedAt: v.optional(v.string()),
      mapId: v.string(),
      mapName: v.optional(v.string()),
      playerName: v.string(),
      userId: v.optional(v.string()),
      team: v.string(),
      kills: v.number(),
      killDeathRatio: v.number(),
      deaths: v.number(),
      offense: v.number(),
      defense: v.number(),
      support: v.number(),
    })),
  })
    .index("id", ["id"])
    .index("userId", ["userId"]),
  matchStats: defineTable({
    guildId: v.string(),
    eventId: v.id("events"),
    sourceUrl: v.string(),
    matchId: v.string(),
    importedAt: v.string(),
    raw: rawMatch,
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("guildId", ["guildId"])
    .index("eventId", ["eventId"]),
});
