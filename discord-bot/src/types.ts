export type ClanLanguage = "en" | "cs";

export type TicketModalQuestion = {
  id: string;
  label: string;
  placeholder?: string;
  style: "short" | "paragraph";
  required: boolean;
};

export type TicketCategory = {
  id: string;
  emoji?: string;
  label?: string;
  description?: string;
  supportRoleIds: string[];
  modalQuestions: TicketModalQuestion[];
};

export type MembershipCategory = {
  id: string;
  emoji?: string;
  label?: string;
  description?: string;
  supportRoleIds: string[];
  recruitRoleId?: string;
  finalRoleId?: string;
  modalQuestions: TicketModalQuestion[];
  assignmentType: "member" | "mercenary";
};

export type TicketSettings = {
  enabled: boolean;
  submitChannelId?: string;
  ticketParentChannelId?: string;
  panelTitle: string;
  panelDescription: string;
  panelImageUrl?: string;
  categories: TicketCategory[];
};

export type MembershipSettings = {
  enabled: boolean;
  submitChannelId?: string;
  applicationParentChannelId?: string;
  panelTitle: string;
  panelDescription: string;
  panelImageUrl?: string;
  autoAssignRecruitOnApply: boolean;
  categories: MembershipCategory[];
};

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
  ticketSettings?: TicketSettings;
  membershipSettings?: MembershipSettings;
  ticketPanelMessageId?: string;
  ticketPanelLastConfigUpdatedAt?: string;
  membershipPanelMessageId?: string;
  membershipPanelLastConfigUpdatedAt?: string;
  ticketCounter?: number;
  membershipApplicationCounter?: number;
  updatedAt: string;
};

export type GuildRecord = {
  id: string;
  discordId: string;
  name: string;
  avatar: string;
  description?: string;
  botInside: boolean;
  adminIds: string[];
  memberIds: string[];
  mercenaryIds: string[];
  updatedAt: string;
};

export type MembershipStatus = "pending" | "recruit" | "active";

export type MembershipApplicationThreadRecord = {
  id: string;
  guildId: string;
  threadId: string;
  parentChannelId: string;
  creatorId: string;
  categoryId: string;
  categoryLabel: string;
  assignmentType: "member" | "mercenary";
  applicationNumber: number;
  assignmentId?: string;
  transcriptMessageId?: string;
  answers: Array<{
    questionId: string;
    label: string;
    value: string;
  }>;
  status: "open" | "closed";
  openedAt: string;
  closedAt?: string;
  closedByUserId?: string;
  closeReason?: string;
  closeOutcome?: "denied" | "pending" | "recruit" | "member" | "mercenary";
  createdAt: string;
  updatedAt: string;
};

export type TicketThreadRecord = {
  id: string;
  guildId: string;
  threadId: string;
  parentChannelId: string;
  creatorId: string;
  categoryId: string;
  categoryLabel: string;
  ticketNumber: number;
  status: "open" | "closed";
  transcriptMessageId?: string;
  answers: Array<{
    questionId: string;
    label: string;
    value: string;
  }>;
  openedAt: string;
  closedAt?: string;
  closedByUserId?: string;
  closeReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type Group = {
  id: string;
  guildId: string;
  name: string;
  color: string;
  discordRoleId?: string;
  discordEmoji?: string;
  updatedAt: string;
};

export type TopicPreset = {
  id: string;
  guildId: string;
  name: string;
  topics: Array<{
    title: string;
    body?: string;
      attachments: string[];
  }>;
  updatedAt: string;
};

export type SquadPreset = {
  id: string;
  guildId: string;
  name: string;
  squads: Array<{
    name: string;
    group: string;
    order: number;
    color: string;
    icon: string;
    roles: Array<{
      name: string;
      color: string;
      icon: string;
      count: number;
      note?: string;
    }>;
  }>;
  updatedAt: string;
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
  createForumChannel: boolean;
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

export type GuildCacheSnapshot = {
  guilds: GuildRecord[];
  configs: DiscordConfig[];
  groups: Group[];
  squadPresets: SquadPreset[];
  topicPresets: TopicPreset[];
};

export type EventSyncIndex = {
  events: Array<{
    id: string;
    guildId: string;
    status: EventRecord["status"];
    updatedAt: string;
  }>;
  rosters: Array<Roster>;
};

export type EventSyncContext = {
  event: EventRecord;
  roster: Roster | null;
  syncState: SyncState | null;
};

export type EventInteractionContext = {
  config: DiscordConfig;
  event: EventRecord;
  groups: Group[];
  roster: Roster | null;
};
