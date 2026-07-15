export type ClanLanguage = "en" | "cs";

export type DiscordConfig = {
  id: string;
  guildId: string;
  timezone: string;
  defaultLanguage: ClanLanguage;
  announcementsChannelId?: string;
  forumCategoryId?: string;
  meetingChannelId?: string;
  clanRoleId?: string;
  dashboardAdminRoleId?: string;
  updatedAt: string;
};

export type Group = {
  id: string;
  name: string;
  color: string;
  discordRoleId?: string;
  discordEmoji?: string;
};

export type TopicPreset = {
  id: string;
  name: string;
  topics: Array<{
    title: string;
    body?: string;
    attachments: string[];
  }>;
};

export type EventRecord = {
  id: string;
  guildId: string;
  kind: "match" | "training";
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
  registrationEnd: string;
  meetingStart: string;
  gameStart: string;
  gameEnd: string;
  pingClan: boolean;
  topicPresetId?: string;
  status: "registration" | "closed" | "starting" | "concluded";
  statusUpdatedAt: string;
  concludedAt?: string;
  attendanceReminderLog: Array<{
    userId: string;
    offsetHours: number;
    sentAt: string;
  }>;
  signUps: Array<{
    userId: string;
    group?: string | null;
  }>;
  participants: Array<{
    userId: string;
    status: "attending" | "not_attending";
    group?: string | null;
    completed?: "passed" | "failed";
    updatedAt: string;
  }>;
  updatedAt: string;
};

export type Roster = {
  id: string;
  eventId: string;
  published: boolean;
  updatedAt: string;
  squads: Array<{
    name: string;
    group: string;
    color: string;
    order: number;
    players: Array<{
      id?: string;
      ack: boolean;
      confirmed?: boolean;
      roleName?: string;
    }>;
  }>;
};

export type SyncState = {
  id: string;
  eventId: string;
  guildId: string;
  announcementChannelId?: string;
  announcementMessageId?: string;
  scheduledEventId?: string;
  scheduledEventStatus?: "scheduled" | "active" | "completed" | "canceled";
  forumChannelId?: string;
  forumThreadId?: string;
  infoMessageId?: string;
  topicMessageIds: string[];
  lastSyncedAt?: string;
  lastEventUpdatedAt?: string;
  lastRosterUpdatedAt?: string;
  lastConfigUpdatedAt?: string;
};

export type SyncPayload = {
  config: DiscordConfig;
  groups: Group[];
  events: EventRecord[];
  rosters: Roster[];
  topicPresets: TopicPreset[];
  syncStates: SyncState[];
};

export type EventInteractionContext = {
  config: DiscordConfig;
  event: EventRecord;
  groups: Group[];
  roster: Roster | null;
};
