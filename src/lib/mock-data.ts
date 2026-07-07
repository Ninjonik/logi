import type {
  AppUser,
  EventRecord,
  Guild,
  Roster,
  SquadPreset,
  TopicPreset,
} from "@/types/domain";

export const mockCurrentUserId = "210000000000001";
export const mockIsAuthenticated = true;

export const mockUsers: AppUser[] = [
  {
    id: "210000000000001",
    steamId: "76561198000000001",
    name: "Clover",
    avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=200&q=80",
    managedGuildIds: ["82ad", "coalition"],
    guildId: "82ad",
    mercenaryGuildIds: ["yko"],
    isStreamer: true,
    score: 142,
    createdAt: "2026-07-01T18:00:00.000Z",
    updatedAt: "2026-07-06T16:00:00.000Z",
  },
  {
    id: "210000000000002",
    name: "Swellboy",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    managedGuildIds: [],
    guildId: "82ad",
    mercenaryGuildIds: [],
    isStreamer: false,
    score: 98,
    createdAt: "2026-07-01T18:00:00.000Z",
    updatedAt: "2026-07-06T16:00:00.000Z",
  },
  {
    id: "210000000000003",
    name: "Mjolk",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80",
    managedGuildIds: [],
    guildId: "82ad",
    mercenaryGuildIds: ["coalition"],
    isStreamer: false,
    score: 115,
    createdAt: "2026-07-01T18:00:00.000Z",
    updatedAt: "2026-07-06T16:00:00.000Z",
  },
  {
    id: "210000000000004",
    name: "Luca",
    avatar: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=200&q=80",
    managedGuildIds: [],
    guildId: "yko",
    mercenaryGuildIds: ["82ad"],
    isStreamer: false,
    score: 74,
    createdAt: "2026-07-01T18:00:00.000Z",
    updatedAt: "2026-07-06T16:00:00.000Z",
  },
  {
    id: "210000000000005",
    name: "Bauspar Fuchs",
    avatar: "https://images.unsplash.com/photo-1506795660185-ffaa3f3b8b1d?auto=format&fit=crop&w=200&q=80",
    managedGuildIds: [],
    guildId: "82ad",
    mercenaryGuildIds: [],
    isStreamer: false,
    score: 91,
    createdAt: "2026-07-01T18:00:00.000Z",
    updatedAt: "2026-07-06T16:00:00.000Z",
  },
  {
    id: "210000000000006",
    name: "Toruk",
    avatar: "https://images.unsplash.com/photo-1499996860823-5214fcc65f8f?auto=format&fit=crop&w=200&q=80",
    managedGuildIds: [],
    guildId: "82ad",
    mercenaryGuildIds: [],
    isStreamer: false,
    score: 87,
    createdAt: "2026-07-01T18:00:00.000Z",
    updatedAt: "2026-07-06T16:00:00.000Z",
  },
];

export const mockGuilds: Guild[] = [
  {
    id: "82ad",
    name: "82AD",
    avatar: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=300&q=80",
    description:
      "Competitive Hell Let Loose unit running weekly campaigns, briefings, and structured combined-arms rosters.",
    botInside: true,
    adminIds: ["210000000000001"],
    memberIds: ["210000000000001", "210000000000002", "210000000000003", "210000000000005", "210000000000006"],
    members: [
      { id: "210000000000001", group: "Command", joinedAt: "2026-02-01T12:00:00.000Z" },
      { id: "210000000000002", group: "Infantry", joinedAt: "2026-02-11T12:00:00.000Z" },
      { id: "210000000000003", group: "Recon", joinedAt: "2026-03-02T12:00:00.000Z" },
      { id: "210000000000005", group: "Nodeplan", joinedAt: "2026-03-15T12:00:00.000Z" },
      { id: "210000000000006", group: "Infantry", joinedAt: "2026-04-10T12:00:00.000Z" },
    ],
    mercenaryIds: ["210000000000004"],
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-07-06T15:00:00.000Z",
  },
  {
    id: "yko",
    name: "YOKO",
    avatar: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=300&q=80",
    description:
      "Allied event partner focused on large-scale public and inter-clan operations.",
    botInside: false,
    adminIds: [],
    memberIds: ["210000000000004"],
    members: [{ id: "210000000000004", group: "Infantry", joinedAt: "2026-02-28T12:00:00.000Z" }],
    mercenaryIds: ["210000000000001"],
    createdAt: "2026-01-18T10:00:00.000Z",
    updatedAt: "2026-07-06T15:00:00.000Z",
  },
  {
    id: "coalition",
    name: "Coalition HQ",
    avatar: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=300&q=80",
    description:
      "Shared staff workspace for cross-unit training nights and campaign planning.",
    botInside: true,
    adminIds: ["210000000000001"],
    memberIds: ["210000000000001", "210000000000003"],
    members: [
      { id: "210000000000001", group: "Admin", joinedAt: "2026-03-22T12:00:00.000Z" },
      { id: "210000000000003", group: "Intel", joinedAt: "2026-03-29T12:00:00.000Z" },
    ],
    mercenaryIds: [],
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-07-06T15:00:00.000Z",
  },
];

export const mockEvents: EventRecord[] = [
  {
    id: "match-0507",
    guildId: "82ad",
    name: "82AD vs YOKO",
    description: "Prime-time friendly with full briefing pack and role acknowledgements.",
    server: "EU Warfare #4",
    serverPassword: "later",
    side: "German",
    map: "Saint Marie Eglise",
    cap: "Warfare",
    notes: "Command meets 15 minutes early for final lane and node planning.",
    registrationEnd: "2026-07-05T15:30:00.000Z",
    meetingStart: "2026-07-05T16:00:00.000Z",
    gameStart: "2026-07-05T16:30:00.000Z",
    gameEnd: "2026-07-05T18:00:00.000Z",
    pingClan: true,
    topicPresetId: "briefing-sme",
    signUps: [
      { userId: "210000000000001", group: "Command" },
      { userId: "210000000000002", group: "Infantry" },
    ],
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-07-05T13:00:00.000Z",
  },
  {
    id: "campaign-0712",
    guildId: "82ad",
    name: "Campaign Night: Hurtgen Push",
    description: "Campaign round with dedicated stream slot and public calendar visibility.",
    server: "Campaign Server A",
    side: "US",
    map: "Hurtgen Forest",
    cap: "Offensive",
    notes: "Streamer slot reserved. Topic preset adapted from forest attack package.",
    registrationEnd: "2026-07-12T14:00:00.000Z",
    meetingStart: "2026-07-12T14:30:00.000Z",
    gameStart: "2026-07-12T15:00:00.000Z",
    gameEnd: "2026-07-12T17:00:00.000Z",
    pingClan: false,
    topicPresetId: "briefing-forest",
    signUps: [{ userId: "210000000000003", group: "Recon" }],
    createdAt: "2026-07-02T09:00:00.000Z",
    updatedAt: "2026-07-06T09:30:00.000Z",
  },
  {
    id: "training-0718",
    guildId: "coalition",
    name: "Coalition Training Block",
    description: "Cross-clan recon and armor coordination workshop.",
    side: "Mixed",
    map: "Foy",
    cap: "Training",
    notes: "Used to validate future Discord sync for attendance roles.",
    registrationEnd: "2026-07-18T17:00:00.000Z",
    meetingStart: "2026-07-18T17:30:00.000Z",
    gameStart: "2026-07-18T18:00:00.000Z",
    gameEnd: "2026-07-18T20:00:00.000Z",
    pingClan: true,
    signUps: [],
    createdAt: "2026-07-03T09:00:00.000Z",
    updatedAt: "2026-07-04T09:30:00.000Z",
  },
];

export const mockTopicPresets: TopicPreset[] = [
  {
    id: "briefing-sme",
    guildId: "82ad",
    name: "Saint Marie Warfare",
    side: "German",
    map: "Saint Marie Eglise",
    cap: "Warfare",
    notes: "Baseline for public clan matches with armor and nodeplan sections.",
    topics: [
      {
        id: "topic-opening-plan",
        title: "Opening Plan",
        body: "Armor holds center road while infantry contests middle strongpoint and recon delays their north garrison route.",
        attachments: [],
      },
      {
        id: "topic-build-priorities",
        title: "Build Priorities",
        body: "HQ truck into west grid. First support pair goes immediate manpower and munitions.",
        attachments: [],
      },
    ],
    createdAt: "2026-06-21T09:00:00.000Z",
    updatedAt: "2026-07-04T09:00:00.000Z",
  },
  {
    id: "briefing-forest",
    guildId: "82ad",
    name: "Forest Offensive Pack",
    side: "US",
    map: "Hurtgen Forest",
    cap: "Offensive",
    notes: "Prepared for campaign nights with heavier spawn discipline notes.",
    topics: [
      {
        id: "topic-commander-intent",
        title: "Commander Intent",
        body: "Preserve tempo and keep south lane garrison chain healthy before committing armor deep.",
        attachments: [],
      },
    ],
    createdAt: "2026-06-23T09:00:00.000Z",
    updatedAt: "2026-07-06T08:00:00.000Z",
  },
];

export const mockSquadPresets: SquadPreset[] = [
  {
    id: "comp-standard",
    guildId: "82ad",
    name: "Competitive Standard 49",
    squads: [
      {
        name: "Command",
        group: "Support Staff",
        order: 0,
        color: "#b59f3b",
        roles: [
          { name: "Commander", color: "#b59f3b", icon: "crown", count: 1 },
          { name: "Artillery Observer", color: "#b59f3b", icon: "binoculars", count: 1 },
        ],
      },
      {
        name: "Recon 1",
        group: "Recon",
        order: 1,
        color: "#8b5cf6",
        roles: [
          { name: "Spotter", color: "#8b5cf6", icon: "crosshair", count: 1 },
          { name: "Sniper", color: "#8b5cf6", icon: "target", count: 1 },
        ],
      },
      {
        name: "Squad 1",
        group: "Infantry Squad",
        order: 2,
        color: "#f97316",
        roles: [
          { name: "Squad Lead", color: "#f97316", icon: "flag", count: 1 },
          { name: "Machine Gunner", color: "#f97316", icon: "shield", count: 1 },
          { name: "Infantry", color: "#f97316", icon: "users", count: 4 },
        ],
      },
      {
        name: "Squad 2",
        group: "Defence",
        order: 3,
        color: "#0ea5e9",
        roles: [
          { name: "Squad Lead", color: "#0ea5e9", icon: "flag", count: 1 },
          { name: "Machine Gunner", color: "#0ea5e9", icon: "shield", count: 1 },
          { name: "Infantry", color: "#0ea5e9", icon: "users", count: 4 },
        ],
      },
    ],
    createdAt: "2026-06-12T09:00:00.000Z",
    updatedAt: "2026-07-05T09:00:00.000Z",
  },
];

export const mockRosters: Roster[] = [
  {
    id: "roster-0507",
    eventId: "match-0507",
    guildId: "82ad",
    squadPresetId: "comp-standard",
    squads: [
      {
        name: "Command",
        group: "Support Staff",
        order: 0,
        color: "#b59f3b",
        players: [
          { id: "210000000000001", ack: true, roleName: "Commander", note: "CO" },
          { roleName: "Artillery Observer", ack: false, note: "Open slot" },
        ],
      },
      {
        name: "Recon 1",
        group: "Recon",
        order: 1,
        color: "#8b5cf6",
        players: [
          { id: "210000000000003", ack: true, roleName: "Spotter" },
          { id: "210000000000004", ack: false, roleName: "Sniper" },
        ],
      },
      {
        name: "Squad 1",
        group: "Infantry Squad",
        order: 2,
        color: "#f97316",
        players: [
          { id: "210000000000002", ack: false, roleName: "Squad Lead" },
          { id: "210000000000006", ack: true, roleName: "Machine Gunner" },
          { id: "210000000000005", ack: true, roleName: "Infantry" },
          { roleName: "Infantry", ack: false, note: "Mercenary needed" },
          { roleName: "Infantry", ack: false },
          { roleName: "Infantry", ack: false },
        ],
      },
      {
        name: "Squad 2",
        group: "Defence",
        order: 3,
        color: "#0ea5e9",
        players: [
          { id: "210000000000005", ack: true, roleName: "Squad Lead" },
          { roleName: "Machine Gunner", ack: false },
          { roleName: "Infantry", ack: false },
          { id: "210000000000006", ack: true, roleName: "Infantry" },
          { roleName: "Infantry", ack: false },
          { roleName: "Infantry", ack: false },
        ],
      },
    ],
    reservePlayerIds: ["210000000000004", "210000000000003"],
    streamerId: "210000000000001",
    published: true,
    createdAt: "2026-07-03T09:00:00.000Z",
    updatedAt: "2026-07-05T11:00:00.000Z",
  },
];

export function getCurrentUser() {
  return mockUsers.find((user) => user.id === mockCurrentUserId) ?? mockUsers[0];
}

export function getGuild(serverId: string) {
  return mockGuilds.find((guild) => guild.id === serverId);
}

export function getGuildEvents(serverId: string) {
  return mockEvents.filter((event) => event.guildId === serverId);
}

export function getGuildTopicPresets(serverId: string) {
  return mockTopicPresets.filter((preset) => preset.guildId === serverId);
}

export function getGuildSquadPresets(serverId: string) {
  return mockSquadPresets.filter((preset) => preset.guildId === serverId);
}

export function getGuildRosters(serverId: string) {
  return mockRosters.filter((roster) => roster.guildId === serverId);
}

export function isGuildAdmin(serverId: string, userId: string) {
  const guild = getGuild(serverId);
  return guild?.adminIds.includes(userId) ?? false;
}
