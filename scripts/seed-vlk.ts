import fs from "node:fs";
import path from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

type GroupRecord = {
  id: string;
  name: string;
  color: string;
  order: number;
  parentId?: string;
  description?: string;
};

type AssignmentRecord = {
  id: string;
  userId: string;
  serverId: string;
  type: "member" | "mercenary";
  primaryGroupId?: string;
  secondaryGroupIds: string[];
  paused: boolean;
  pausedNote?: string;
  createdAt: string;
  updatedAt: string;
};

type UserRecord = {
  id: string;
  name: string;
  avatar: string;
};

type GuildRecord = {
  id: string;
  name: string;
  avatar: string;
  adminIds: string[];
  memberIds: string[];
  mercenaryIds: string[];
  botInside: boolean;
};

type EventRecord = {
  id: string;
  name: string;
  meetingStart: string;
};

type RosterRecord = {
  id: string;
  eventId: string;
};

type SquadPresetRecord = {
  id: string;
  name: string;
};

type ServerContext = {
  user: UserRecord;
  server: GuildRecord;
  canAdmin: boolean;
  events: EventRecord[];
  topicPresets: unknown[];
  squadPresets: SquadPresetRecord[];
  rosters: RosterRecord[];
  groups: GroupRecord[];
  assignments: AssignmentRecord[];
};

type SeedPlayer = {
  id: string;
  name: string;
  avatar: string;
  primaryGroup: string;
  secondaryGroups: string[];
};

type SeedEvent = {
  name: string;
  description: string;
  map: string;
  side: string;
  cap: string;
  date: string;
  durationMinutes: number;
  matchUrl: string;
  competition?: string;
  opponent: string;
};

type RosterPlayer = {
  id?: string;
  ack: boolean;
  note?: string;
  roleName?: string;
};

type RosterSquad = {
  name: string;
  group: string;
  order: number;
  color: string;
  icon?: string;
  players: RosterPlayer[];
};

const DEFAULT_GUILD_ID = "1035627488828735518";

const getGuildByIdReference = makeFunctionReference<"query">("guilds:getById");
const getServerContextReference = makeFunctionReference<"query">("serverData:getServerContext");
const syncDiscordProfileReference = makeFunctionReference<"mutation">("players:syncDiscordProfile");
const upsertAssignmentReference = makeFunctionReference<"mutation">("userAssignments:upsert");
const upsertEventReference = makeFunctionReference<"mutation">("events:upsert");
const upsertRosterReference = makeFunctionReference<"mutation">("rosters:upsert");

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envFile = fs.readFileSync(envPath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function normalizePlayerName(raw: string) {
  return raw
    .replace(/^VLK[ㆍr\- ]+/u, "")
    .replace(/^VLKr[ㆍ\- ]+/u, "")
    .replace(/\s+🏄$/u, "")
    .trim();
}

function toAvatarUrl(seed: string) {
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(seed)}`;
}

function buildSeedPlayers(): SeedPlayer[] {
  const commander = ["Sandiary"];
  const artillery = ["ZUGY-CZ"];
  const armor = [
    "MORE",
    "Vintag",
    "drakobiec",
    "WΦRRY",
    "Patronas",
    "DarkVendrick",
    "Majk",
    "GoLeM",
    "TurboAgresor",
    "Chromalife",
    "Simply",
    "Amumbofis",
  ];
  const recon = ["OmniisCZ", "Fejfi", "L4ngy_", "Ninjonik"];
  const defense = ["Peterkys", "Kardy", "HellfuhRer", "Pan Brepta", "lakatoš59"];
  const flex = ["Larry", "LuBoss", "Štěpáncz", "Harder_CZ", "FriKeeK55"];
  const infantry = [
    "Ka$heK",
    "Dominik",
    "Meduz",
    "Hopity CZ",
    "RoboCZ",
    "JanRiedl",
    "Doomino789",
    "MetYou",
    "Dorfieee",
    "Lucky",
    "Maximus",
    "Toshiro08CZ",
    "TommikS",
    "Bl4y3r CZ",
    "LoreMaster",
    "Krejcar",
    "DesertFox19",
    "Rennee77",
    "MysliCzek",
    "Samik",
    "Krtkova",
    "yoss",
  ];

  const byGroup: Array<[string, string[], string[]]> = [
    ["Command", commander, ["Infantry"]],
    ["Artillery", artillery, ["Command"]],
    ["Armor", armor, ["Flex"]],
    ["Recon", recon, ["Infantry"]],
    ["Defense", defense, ["Infantry"]],
    ["Flex", flex, ["Infantry"]],
    ["Infantry", infantry, ["Flex"]],
  ];

  return byGroup.flatMap(([primaryGroup, names, secondaryGroups]) =>
    names.map((name) => {
      const normalized = normalizePlayerName(name);
      return {
        id: `mock-vlk-${slugify(normalized)}`,
        name: `VLK ${normalized}`,
        avatar: toAvatarUrl(normalized),
        primaryGroup,
        secondaryGroups,
      };
    }),
  );
}

function buildSeedEvents(): SeedEvent[] {
  return [
    {
      name: "VLK vs BxB",
      description: "Friendly match imported from HeLO match history for Valkyria test data.",
      map: "Omaha Beach",
      side: "Axis",
      cap: "Defeat (2-3)",
      date: "2026-06-28",
      durationMinutes: 90,
      matchUrl: "https://helo-system.de/statistics/matches/BxB-VLK-2026-06-28?series=2024",
      opponent: "BxB",
    },
    {
      name: "VLK vs LCM",
      description: "Friendly match imported from HeLO match history for Valkyria test data.",
      map: "PHL",
      side: "Allies",
      cap: "Victory (5-0) in 72min",
      date: "2026-05-24",
      durationMinutes: 72,
      matchUrl: "https://helo-system.de/statistics/matches/VLK-LCM-2026-05-24?series=2024",
      opponent: "LCM",
    },
    {
      name: "VLK vs HTD",
      description: "Competitive ECL match imported from HeLO match history for Valkyria test data.",
      map: "SMDM",
      side: "Axis",
      cap: "Defeat (2-3)",
      date: "2026-04-26",
      durationMinutes: 90,
      matchUrl: "https://helo-system.de/statistics/matches/HTD-VLK-2026-04-26?series=2024",
      competition: "ECL",
      opponent: "HTD",
    },
    {
      name: "VLK vs LORD",
      description: "Friendly match imported from HeLO match history for Valkyria test data.",
      map: "SME",
      side: "Allies",
      cap: "Victory (3-2)",
      date: "2026-04-19",
      durationMinutes: 90,
      matchUrl: "https://helo-system.de/statistics/matches/VLK-WAR-2026-04-19?series=2024",
      opponent: "LORD",
    },
    {
      name: "VLK vs FCo",
      description: "Competitive ECL match imported from HeLO match history for Valkyria test data.",
      map: "Omaha Beach",
      side: "Allies",
      cap: "Victory (3-2)",
      date: "2026-04-12",
      durationMinutes: 90,
      matchUrl: "https://helo-system.de/statistics/matches/VLK-FF-2026-04-12?series=2024",
      competition: "ECL",
      opponent: "FCo",
    },
    {
      name: "VLK vs PZJR",
      description: "Friendly match imported from HeLO match history for Valkyria test data.",
      map: "SMDM",
      side: "Allies",
      cap: "Victory (4-1)",
      date: "2026-03-22",
      durationMinutes: 90,
      matchUrl: "https://helo-system.de/statistics/matches/VLK-PZJR-2026-03-22?series=2024",
      opponent: "PZJR",
    },
    {
      name: "VLK vs FLL",
      description: "Competitive ECL match imported from HeLO match history for Valkyria test data.",
      map: "Omaha Beach",
      side: "Axis",
      cap: "Victory (4-1)",
      date: "2026-03-15",
      durationMinutes: 90,
      matchUrl: "https://helo-system.de/statistics/matches/VLK-FLL-2026-03-15?series=2024",
      competition: "ECL",
      opponent: "FLL",
    },
    {
      name: "VLK vs HTD (March)",
      description: "Competitive ECL match imported from HeLO match history for Valkyria test data.",
      map: "SMDM",
      side: "Allies",
      cap: "Defeat (1-4)",
      date: "2026-03-01",
      durationMinutes: 90,
      matchUrl: "https://helo-system.de/statistics/matches/HTD-VLK-2026-03-01?series=2024",
      competition: "ECL",
      opponent: "HTD",
    },
  ];
}

function buildRosterTemplate(): Array<{
  name: string;
  group: string;
  order: number;
  color: string;
  icon: string;
  roles: Array<{ name: string; count: number }>;
}> {
  return [
    {
      name: "Commander",
      group: "Command",
      order: 0,
      color: "#d4a017",
      icon: "/img/roles/icn_commander.png",
      roles: [{ name: "Commander", count: 1 }],
    },
    {
      name: "Artillery",
      group: "Artillery",
      order: 1,
      color: "#b45309",
      icon: "/img/roles/icn_mg.png",
      roles: [{ name: "Artillery", count: 1 }],
    },
    {
      name: "Red",
      group: "Infantry",
      order: 2,
      color: "#dc2626",
      icon: "/img/roles/icn_officer.png",
      roles: [
        { name: "Squad Leader", count: 2 },
        { name: "Infantry", count: 5 },
      ],
    },
    {
      name: "Blue",
      group: "Infantry",
      order: 3,
      color: "#2563eb",
      icon: "/img/roles/icn_officer.png",
      roles: [
        { name: "Squad Leader", count: 2 },
        { name: "Infantry", count: 5 },
      ],
    },
    {
      name: "Green",
      group: "Infantry",
      order: 4,
      color: "#16a34a",
      icon: "/img/roles/icn_officer.png",
      roles: [
        { name: "Squad Leader", count: 2 },
        { name: "Infantry", count: 5 },
      ],
    },
    {
      name: "Defend",
      group: "Defense",
      order: 5,
      color: "#f59e0b",
      icon: "/img/roles/icn_officer.png",
      roles: [
        { name: "Squad Leader", count: 2 },
        { name: "Infantry", count: 3 },
      ],
    },
    {
      name: "Recon 1",
      group: "Recon",
      order: 6,
      color: "#0f766e",
      icon: "/img/roles/icn_recon.png",
      roles: [
        { name: "Squad Leader", count: 1 },
        { name: "Sniper", count: 1 },
      ],
    },
    {
      name: "Recon 2",
      group: "Recon",
      order: 7,
      color: "#0f766e",
      icon: "/img/roles/icn_recon.png",
      roles: [
        { name: "Squad Leader", count: 1 },
        { name: "Sniper", count: 1 },
      ],
    },
    {
      name: "Flex",
      group: "Flex",
      order: 8,
      color: "#64748b",
      icon: "/img/roles/icn_officer.png",
      roles: [
        { name: "Squad Leader", count: 2 },
        { name: "Infantry", count: 3 },
      ],
    },
    {
      name: "Tank 1",
      group: "Armor",
      order: 9,
      color: "#7c3aed",
      icon: "/img/roles/icn_tankCommand.png",
      roles: [
        { name: "Tank Commander", count: 1 },
        { name: "Gunner", count: 1 },
        { name: "Driver", count: 1 },
      ],
    },
    {
      name: "Tank 2",
      group: "Armor",
      order: 10,
      color: "#8b5cf6",
      icon: "/img/roles/icn_tankCommand.png",
      roles: [
        { name: "Tank Commander", count: 1 },
        { name: "Gunner", count: 1 },
        { name: "Driver", count: 1 },
      ],
    },
    {
      name: "Tank 3",
      group: "Armor",
      order: 11,
      color: "#a78bfa",
      icon: "/img/roles/icn_tankCommand.png",
      roles: [
        { name: "Tank Commander", count: 1 },
        { name: "Gunner", count: 1 },
        { name: "Driver", count: 1 },
      ],
    },
    {
      name: "Tank 4",
      group: "Armor",
      order: 12,
      color: "#c4b5fd",
      icon: "/img/roles/icn_tankCommand.png",
      roles: [
        { name: "Tank Commander", count: 1 },
        { name: "Gunner", count: 1 },
        { name: "Driver", count: 1 },
      ],
    },
  ];
}

function pickPlayer(
  preferredGroup: string,
  pools: Map<string, SeedPlayer[]>,
  usedIds: Set<string>,
  fallbackGroups: string[] = [],
) {
  const candidateGroups = [preferredGroup, ...fallbackGroups];
  for (const groupName of candidateGroups) {
    const groupPool = pools.get(groupName) ?? [];
    const candidate = groupPool.find((player) => !usedIds.has(player.id));
    if (candidate) {
      usedIds.add(candidate.id);
      return candidate;
    }
  }

  for (const groupPool of pools.values()) {
    const candidate = groupPool.find((player) => !usedIds.has(player.id));
    if (candidate) {
      usedIds.add(candidate.id);
      return candidate;
    }
  }

  return undefined;
}

function buildRosterForPlayers(players: SeedPlayer[]) {
  const template = buildRosterTemplate();
  const usedIds = new Set<string>();
  const pools = new Map<string, SeedPlayer[]>();

  for (const player of players) {
    const current = pools.get(player.primaryGroup) ?? [];
    current.push(player);
    pools.set(player.primaryGroup, current);
  }

  const squads: RosterSquad[] = template.map((squad) => {
    const rolePlayers: RosterPlayer[] = [];

    for (const role of squad.roles) {
      for (let index = 0; index < role.count; index += 1) {
        const fallbackGroups =
          squad.group === "Command"
            ? ["Artillery", "Infantry", "Flex"]
            : squad.group === "Artillery"
              ? ["Command", "Flex"]
              : squad.group === "Recon"
                ? ["Infantry", "Flex"]
                : squad.group === "Defense"
                  ? ["Infantry", "Flex"]
                  : squad.group === "Armor"
                    ? ["Flex", "Infantry"]
                    : ["Flex", "Defense", "Recon", "Armor"];

        const player = pickPlayer(squad.group, pools, usedIds, fallbackGroups);
        rolePlayers.push({
          id: player?.id,
          ack: Boolean(player),
          roleName: role.name,
          note: player ? undefined : "Open slot",
        });
      }
    }

    return {
      name: squad.name,
      group: squad.group,
      order: squad.order,
      color: squad.color,
      icon: squad.icon,
      players: rolePlayers,
    };
  });

  const reservePlayerIds = players
    .filter((player) => !usedIds.has(player.id))
    .map((player) => player.id);

  return {
    squads,
    reservePlayerIds,
    notAttendingPlayerIds: [],
  };
}

function toEventTimes(date: string, durationMinutes: number) {
  const registrationEnd = `${date}T18:00:00.000Z`;
  const meetingStart = `${date}T19:15:00.000Z`;
  const gameStart = `${date}T19:30:00.000Z`;
  const gameEndDate = new Date(`${date}T19:30:00.000Z`);
  gameEndDate.setUTCMinutes(gameEndDate.getUTCMinutes() + durationMinutes);

  return {
    registrationEnd,
    meetingStart,
    gameStart,
    gameEnd: gameEndDate.toISOString(),
  };
}

async function main() {
  loadLocalEnv();

  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ??
    process.env.CONVEX_SELF_HOSTED_URL ??
    process.env.CONVEX_URL;
  const secret = process.env.INTERNAL_AUTH_SECRET;
  const guildId = process.argv[2] ?? DEFAULT_GUILD_ID;

  if (!convexUrl) {
    throw new Error("Missing Convex URL env. Expected NEXT_PUBLIC_CONVEX_URL or CONVEX_SELF_HOSTED_URL.");
  }

  if (!secret) {
    throw new Error("Missing INTERNAL_AUTH_SECRET env.");
  }

  const client = new ConvexHttpClient(convexUrl);
  const guild = (await client.query(getGuildByIdReference, { guildId })) as GuildRecord | null;

  if (!guild) {
    throw new Error(`Guild ${guildId} was not found.`);
  }

  const adminUserId = guild.adminIds[0];
  if (!adminUserId) {
    throw new Error(`Guild ${guildId} has no admin user, so server context cannot be loaded.`);
  }

  const initialContext = (await client.query(getServerContextReference, {
    userId: adminUserId,
    serverId: guildId,
  })) as ServerContext | null;

  if (!initialContext) {
    throw new Error(`Unable to load server context for guild ${guildId}.`);
  }

  const groupIdByName = new Map(initialContext.groups.map((group) => [group.name, group.id]));
  const requiredGroups = ["Command", "Artillery", "Armor", "Recon", "Defense", "Flex", "Infantry"];
  for (const groupName of requiredGroups) {
    if (!groupIdByName.has(groupName)) {
      throw new Error(`Group "${groupName}" is missing in guild ${guildId}. Initialize helper data first.`);
    }
  }

  const existingAssignmentByUserId = new Map(
    initialContext.assignments.map((assignment) => [assignment.userId, assignment]),
  );
  const existingEventByName = new Map(initialContext.events.map((event) => [event.name, event]));
  const existingRosterByEventId = new Map(initialContext.rosters.map((roster) => [roster.eventId, roster]));
  const defaultPresetId = initialContext.squadPresets.find((preset) => preset.name === "HLL Standard Lineup")?.id;

  const seedPlayers = buildSeedPlayers();
  console.log(`Seeding ${seedPlayers.length} mock VLK players into guild ${guildId}...`);

  for (const player of seedPlayers) {
    await client.mutation(syncDiscordProfileReference, {
      secret,
      id: player.id,
      name: player.name,
      avatar: player.avatar,
    });

    const existingAssignment = existingAssignmentByUserId.get(player.id);
    await client.mutation(upsertAssignmentReference, {
      secret,
      assignmentId: existingAssignment?.id as never,
      serverId: guildId,
      userId: player.id,
      type: "member",
      primaryGroupId: groupIdByName.get(player.primaryGroup) as never,
      secondaryGroupIds: player.secondaryGroups
        .map((groupName) => groupIdByName.get(groupName))
        .filter((groupId): groupId is string => Boolean(groupId)) as never,
      paused: false,
      pausedNote: undefined,
    });
  }

  const seededEventIds: string[] = [];
  for (const event of buildSeedEvents()) {
    const existingEvent = existingEventByName.get(event.name);
    const times = toEventTimes(event.date, event.durationMinutes);
    const descriptionParts = [
      event.description,
      `Opponent: ${event.opponent}`,
      event.competition ? `Competition: ${event.competition}` : undefined,
      `HeLO: ${event.matchUrl}`,
    ].filter(Boolean);

    const eventId = (await client.mutation(upsertEventReference, {
      secret,
      serverId: guildId,
      eventId: existingEvent?.id as never,
      name: event.name,
      description: descriptionParts.join("\n"),
      server: undefined,
      serverPassword: undefined,
      side: event.side,
      map: event.map,
      cap: event.cap,
      notes: `Imported mock event for testing from ${event.matchUrl}`,
      registrationEnd: times.registrationEnd,
      meetingStart: times.meetingStart,
      gameStart: times.gameStart,
      gameEnd: times.gameEnd,
      pingClan: false,
      topicPresetId: undefined,
    })) as string;

    seededEventIds.push(eventId);
  }

  const refreshedContext = (await client.query(getServerContextReference, {
    userId: adminUserId,
    serverId: guildId,
  })) as ServerContext | null;

  if (!refreshedContext) {
    throw new Error(`Unable to reload server context for guild ${guildId} after seeding.`);
  }

  const rosterPlayers = seedPlayers;
  const rosterPayload = buildRosterForPlayers(rosterPlayers);
  const refreshedEventByName = new Map(refreshedContext.events.map((event) => [event.name, event]));
  const refreshedRosterByEventId = new Map(refreshedContext.rosters.map((roster) => [roster.eventId, roster]));

  for (const event of buildSeedEvents()) {
    const currentEvent = refreshedEventByName.get(event.name);
    if (!currentEvent) {
      continue;
    }

    const existingRoster = refreshedRosterByEventId.get(currentEvent.id) ?? existingRosterByEventId.get(currentEvent.id);
    await client.mutation(upsertRosterReference, {
      rosterId: existingRoster?.id as never,
      eventId: currentEvent.id as never,
      squadPresetId: (defaultPresetId ?? undefined) as never,
      squads: rosterPayload.squads,
      reservePlayerIds: rosterPayload.reservePlayerIds,
      notAttendingPlayerIds: rosterPayload.notAttendingPlayerIds,
      streamerId: undefined,
      published: true,
    });
  }

  console.log(`Seed complete for ${guild.name}.`);
  console.log(`Created or updated ${seedPlayers.length} players.`);
  console.log(`Created or updated ${seededEventIds.length} events with published rosters.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
