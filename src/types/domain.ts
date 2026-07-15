export type Timestamp = string;

export type EventStatus = "registration" | "closed" | "starting" | "concluded";

export type EventOutcome = "victory" | "defeat" | "draw";
export type EventKind = "match" | "training";

export type AppUser = {
  _reserveSection?: string;
  id: string;
  discordId: string;
  platformIds: string[];
  name: string;
  avatar: string;
  managedGuildIds: string[];
  guildId?: string;
  mercenaryGuildIds: string[];
  isStreamer: boolean;
  score: number;
  performance?: {
    matchesPlayed: number;
    averages: {
      kills: number;
      killDeathRatio: number;
      deaths: number;
      offense: number;
      defense: number;
      support: number;
    };
  };
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
  discordId: string;
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
  kind: EventKind;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  meetingChannelId?: string;
  requiredRoleIds: string[];
  rewardRoleIds: string[];
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
  matchStatsId?: string;
  matchId?: string;
  eventResult?: {
    sourceUrl: string;
    mapId: string;
    mapName?: string;
    endedAt?: Timestamp;
    importedAt: Timestamp;
    sideA: string;
    sideB: string;
    outcome: EventOutcome;
    score: {
      sideA: number;
      sideB: number;
    };
  };
  attendanceReminderLog: {
    userId: string;
    offsetHours: number;
    sentAt: Timestamp;
  }[];
  participants: {
    userId: string;
    status: "attending" | "not_attending";
    group?: string | null;
    completed?: "passed" | "failed";
    updatedAt: Timestamp;
  }[];
  signUps: {
    userId: string;
    group?: string | null;
  }[];
  scoreAppliedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type MatchTeamSide = "axis" | "allies" | "unknown";

export type MatchStatBreakdown = Partial<{
  infantry: number;
  mine: number;
  sniper: number;
  armor: number;
  satchel: number;
  grenade: number;
  machine_gun: number;
  bazooka: number;
  artillery: number;
  commander: number;
}>;

export type MatchStatsRecord = {
  id: string;
  guildId: string;
  eventId: string;
  matchId: string;
  sourceUrl: string;
  importedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  raw: {
    id: number;
    creation_time: Timestamp;
    start: Timestamp;
    end: Timestamp;
    server_number: number;
    map_name: string;
    result: {
      axis: number;
      allied: number;
    };
    game_layout: {
      requested: Array<number | null>;
      set: string[];
    };
    player_stats: Array<{
      id: number;
      player_id: string;
      player: string;
      map_id: number;
      kills: number;
      kills_by_type?: MatchStatBreakdown;
      kills_streak: number;
      deaths: number;
      deaths_by_type?: MatchStatBreakdown;
      deaths_without_kill_streak: number;
      teamkills: number;
      teamkills_streak: number;
      deaths_by_tk: number;
      deaths_by_tk_streak: number;
      nb_vote_started: number;
      nb_voted_yes: number;
      nb_voted_no: number;
      time_seconds: number;
      kills_per_minute: number;
      deaths_per_minute: number;
      kill_death_ratio: number;
      longest_life_secs: number;
      shortest_life_secs: number;
      combat: number;
      offense: number;
      defense: number;
      support: number;
      most_killed: Record<string, number>;
      death_by: Record<string, number>;
      weapons: Record<string, number>;
      death_by_weapons: Record<string, number>;
      team: {
        side: MatchTeamSide;
        confidence?: "strong" | "mixed";
        ratio?: number;
      };
      level: number;
    }>;
    map: {
      id: string;
      game_mode: string;
      attackers?: string | null;
      environment: string;
      pretty_name: string;
      image_name: string;
      map: {
        id: string;
        name: string;
        tag: string;
        pretty_name: string;
        shortname: string;
        allies: {
          name: string;
          team: MatchTeamSide;
        };
        axis: {
          name: string;
          team: MatchTeamSide;
        };
        orientation: string;
      };
    };
  };
};

export type MatchRecord = MatchStatsRecord;

export type PlayerMatchStats = {
  eventId: string;
  sourceUrl: string;
  importedAt: Timestamp;
  endedAt?: Timestamp;
  mapId: string;
  mapName?: string;
  playerName: string;
  userId?: string;
  team: string;
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
