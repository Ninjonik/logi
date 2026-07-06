export type Timestamp = string;

export type AppUser = {
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
  group: string;
  joinedAt?: Timestamp;
};

export type Guild = {
  id: string;
  name: string;
  avatar: string;
  description?: string;
  adminIds: string[];
  memberIds: string[];
  members: GuildMember[];
  mercenaryIds: string[];
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  note?: string;
  roleName?: string;
};

export type RosterSquad = {
  name: string;
  group: string;
  order: number;
  color: string;
  players: RosterPlayer[];
};

export type Roster = {
  id: string;
  eventId: string;
  guildId: string;
  squadPresetId?: string;
  squads: RosterSquad[];
  reservePlayerIds: string[];
  streamerId?: string;
  published: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
