export type Timestamp = string;

export type EventStatus = "registration" | "closed" | "starting" | "concluded";

export type EventTeamSide = "axis" | "allies";
export type EventOutcome = "victory" | "defeat" | "draw";

export type AppUser = {
  _reserveSection?: string;
  id: string;
  steamId?: string;
  name: string;
  avatar: string;
  managedGuildIds: string[];
  guildId?: string;
  mercenaryGuildIds: string[];
  isStreamer: boolean;
  score: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type GuildMember = {
  id: string;
  primaryGroup?: string;
  secondaryGroups: string[];
  joinedAt?: Timestamp;
};

export type Guild = {
  id: string;
  name: string;
  avatar: string;
  description?: string;
  rosterScoreSettings: {
    noResponse: number;
    declined: number;
    accepted: number;
  };
  botInside: boolean;
  canAdmin?: boolean;
  adminIds: string[];
  memberIds: string[];
  members: GuildMember[];
  mercenaryIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type DiscordGroupLink = {
  groupId: string;
  roleId?: string;
  emoji?: string;
};

export type DiscordConfig = {
  id: string;
  guildId: string;
  timezone: string;
  defaultLanguage: "en" | "cs";
  announcementsChannelId?: string;
  forumCategoryId?: string;
  meetingChannelId?: string;
  clanRoleId?: string;
  dashboardAdminRoleId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type DiscordMemberAccess = {
  id: string;
  guildId: string;
  userId: string;
  roleIds: string[];
  voiceChannelId?: string;
  isAdmin: boolean;
  hasDashboardAccess: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Group = {
  id: string;
  guildId: string;
  name: string;
  color: string;
  order: number;
  parentId?: string;
  description?: string;
  discordRoleId?: string;
  discordEmoji?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type EventRecord = {
  id: string;
  guildId: string;
  name: string;
  description?: string;
  server?: string;
  serverPassword?: string;
  side?: string;
  map?: string;
  cap?: string;
  notes?: string;
  registrationEnd: Timestamp;
  meetingStart: Timestamp;
  gameStart: Timestamp;
  gameEnd: Timestamp;
  pingClan: boolean;
  topicPresetId?: string;
  status: EventStatus;
  statusUpdatedAt: Timestamp;
  concludedAt?: Timestamp;
  eventResult?: {
    sourceUrl: string;
    mapId: string;
    mapName?: string;
    endedAt?: Timestamp;
    importedAt: Timestamp;
    localTeam: EventTeamSide;
    enemyTeam: EventTeamSide;
    outcome: EventOutcome;
    score: {
      axis: number;
      allied: number;
      local: number;
      enemy: number;
    };
  };
  attendanceReminderLog: {
    userId: string;
    offsetHours: number;
    sentAt: Timestamp;
  }[];
  signUps: {
    userId: string;
    group?: string | null;
  }[];
  scoreAppliedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type PlayerMatchStats = {
  eventId: string;
  sourceUrl: string;
  importedAt: Timestamp;
  endedAt?: Timestamp;
  mapId: string;
  mapName?: string;
  playerName: string;
  userId?: string;
  team: EventTeamSide | "unknown";
  kills: number;
  killDeathRatio: number;
  deaths: number;
  offense: number;
  defense: number;
  support: number;
};

export type Topic = {
  id?: string;
  title: string;
  body?: string;
  attachments: string[];
};

export type TopicPreset = {
  id: string;
  name: string;
  side?: string;
  map?: string;
  cap?: string;
  notes?: string;
  topics: Topic[];
  guildId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type SquadRole = {
  name: string;
  color: string;
  icon: string;
  count: number;
  note?: string;
};

export type SquadPresetSquad = {
  name: string;
  group: string;
  order: number;
  color: string;
  icon: string;
  roles: SquadRole[];
};

export type SquadPreset = {
  id: string;
  name: string;
  squads: SquadPresetSquad[];
  guildId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type RosterPlayer = {
  id?: string;
  ack: boolean;
  confirmed?: boolean;
  note?: string;
  roleName?: string;
  roleIcon?: string;
};

export type RosterSquad = {
  name: string;
  group: string;
  order: number;
  color: string;
  icon?: string;
  players: RosterPlayer[];
};

export type Roster = {
  id: string;
  eventId: string;
  guildId: string;
  squadPresetId?: string;
  squads: RosterSquad[];
  reservePlayerIds: string[];
  notAttendingPlayerIds: string[];
  streamerId?: string;
  published: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
