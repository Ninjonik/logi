import { saveServerEvent, saveServerEventResult } from "@/lib/server-events";
import { getServerUserAssignments, getUsersByIds, listUsers, savePlayerPlatformId } from "@/lib/server-user-management";
import { savePlayerMatchStats } from "@/lib/server-player-stats";

type ExternalTeam = "axis" | "allies" | "unknown";

type ScoreboardResponse = {
  failed: boolean;
  error: string | null;
  result: {
    id: number;
    creation_time: string;
    start: string;
    end: string;
    server_number: number;
    map_name: string;
    result: {
      axis: number;
      allied: number;
    };
    map: {
      pretty_name: string;
      game_mode: string;
      environment: string;
      map: {
        allies: { name: string; team: "allies" };
        axis: { name: string; team: "axis" };
      };
    };
    player_stats: Array<{
      player_id: string;
      player: string;
      kill_death_ratio: number;
      kills: number;
      deaths: number;
      offense: number;
      defense: number;
      support: number;
      team: {
        side: ExternalTeam;
      };
    }>;
  };
};

type PreparedPlayerImport = {
  id: string;
  userId: string;
  latestName: string;
  match: {
    sourceUrl: string;
    importedAt: string;
    endedAt: string;
    mapId: string;
    mapName: string;
    playerName: string;
    userId: string;
    team: ExternalTeam;
    kills: number;
    killDeathRatio: number;
    deaths: number;
    offense: number;
    defense: number;
    support: number;
  };
};

function normalizeValue(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function parseDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoString(value: Date | null, fallback: Date) {
  return (value ?? fallback).toISOString();
}

export function normalizeImportedEventLinks(value: string) {
  const links = value
    .split(/[\n,]+/g)
    .map((entry) => entry.trim().replace(/\s+/g, ""))
    .filter(Boolean);

  return [...new Set(links)];
}

export function extractMatchIdFromLink(value: string) {
  const trimmed = value.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Please provide a valid match link.");
  }

  const match = url.pathname.match(/\/games\/(\d+)\/?$/i);
  if (!match) {
    throw new Error("The link must point to /games/[id].");
  }

  return {
    sourceUrl: trimmed,
    mapId: match[1],
    apiUrl: `${url.origin}/api/get_map_scoreboard?map_id=${match[1]}`,
  };
}

async function fetchScoreboard(matchLink: string) {
  const { apiUrl, mapId, sourceUrl } = extractMatchIdFromLink(matchLink);
  const response = await fetch(apiUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch match results.");
  }

  const payload = await response.json() as ScoreboardResponse;
  if (payload.failed || !payload.result) {
    throw new Error(payload.error ?? "Unable to fetch match results.");
  }

  return { apiUrl, mapId, sourceUrl, payload };
}

function stripClanTag(playerName: string, clanTag: string) {
  const trimmedPlayerName = playerName.trim();
  const trimmedClanTag = clanTag.trim();
  if (!trimmedPlayerName || !trimmedClanTag) {
    return null;
  }

  const normalizedPlayerName = normalizeValue(trimmedPlayerName);
  const normalizedClanTag = normalizeValue(trimmedClanTag);
  if (!normalizedPlayerName.startsWith(normalizedClanTag)) {
    return null;
  }

  const strippedName = trimmedPlayerName.slice(trimmedClanTag.length).trim();
  return strippedName || null;
}

function buildUniqueUserMap(users: Awaited<ReturnType<typeof getUsersByIds>>) {
  const counts = new Map<string, number>();
  for (const user of users) {
    const normalizedName = normalizeValue(user.name);
    if (!normalizedName) {
      continue;
    }
    counts.set(normalizedName, (counts.get(normalizedName) ?? 0) + 1);
  }

  return new Map(
    users.flatMap((user) => {
      const normalizedName = normalizeValue(user.name);
      if (!normalizedName || counts.get(normalizedName) !== 1) {
        return [];
      }
      return [[normalizedName, user] as const];
    }),
  );
}

function resolveLocalTeam(eventSide: string | undefined, payload: ScoreboardResponse["result"]) {
  const normalizedEventSide = normalizeValue(eventSide);
  if (!normalizedEventSide) {
    return null;
  }

  const axisNames = new Set([
    "axis",
    payload.map.map.axis.team,
    payload.map.map.axis.name,
  ].map(normalizeValue));
  const alliedNames = new Set([
    "allies",
    "allied",
    payload.map.map.allies.team,
    payload.map.map.allies.name,
  ].map(normalizeValue));

  if (axisNames.has(normalizedEventSide)) {
    return "axis" as const;
  }
  if (alliedNames.has(normalizedEventSide)) {
    return "allies" as const;
  }

  return null;
}

function buildEventResult(eventSide: string | undefined, sourceUrl: string, mapId: string, payload: ScoreboardResponse["result"]) {
  const localTeam = resolveLocalTeam(eventSide, payload);
  if (!localTeam) {
    return null;
  }

  const enemyTeam: "axis" | "allies" = localTeam === "axis" ? "allies" : "axis";
  const axisScore = payload.result.axis;
  const alliedScore = payload.result.allied;
  const localScore = localTeam === "axis" ? axisScore : alliedScore;
  const enemyScore = enemyTeam === "axis" ? axisScore : alliedScore;

  return {
    sourceUrl,
    mapId,
    mapName: payload.map.pretty_name,
    endedAt: payload.end,
    importedAt: new Date().toISOString(),
    localTeam,
    enemyTeam,
    outcome: localScore === enemyScore ? "draw" as const : localScore > enemyScore ? "victory" as const : "defeat" as const,
    score: {
      axis: axisScore,
      allied: alliedScore,
      local: localScore,
      enemy: enemyScore,
    },
  };
}

async function buildServerUserLookups(serverId: string) {
  const assignments = await getServerUserAssignments(serverId);
  const users = await getUsersByIds(assignments.map((assignment) => assignment.userId));

  console.log("[match-results] import:candidate-pool", {
    serverId,
    assignmentCount: assignments.length,
    userCount: users.length,
    users: users.map((user) => ({
      userId: user.id,
      name: user.name,
      platformId: user.platformId,
      normalizedName: user.name,
    })),
  });

  const usersByPlatformId = new Map(
    users
      .filter((user) => user.platformId)
      .map((user) => [normalizeValue(user.platformId), user]),
  );
  const usersByName = new Map(
    users.flatMap((user) => {
      const exactName = normalizeValue(user.name);
      const normalizedNickname = user.name;
      const aliases = [...new Set([exactName, normalizedNickname].filter(Boolean))];
      return aliases.map((alias) => [alias, user] as const);
    }),
  );

  return { usersByPlatformId, usersByName };
}

async function preparePlayerImports(input: {
  serverId: string;
  payload: ScoreboardResponse["result"];
  sourceUrl: string;
  mapId: string;
  eventIdForLogs: string;
}) {
  const { usersByPlatformId, usersByName } = await buildServerUserLookups(input.serverId);
  const importedAt = new Date().toISOString();
  const sideCounts = {
    axis: 0,
    allies: 0,
  };

  const entries = input.payload.player_stats.flatMap((player) => {
    const normalizedPlayerId = normalizeValue(player.player_id);
    const normalizedPlayerName = normalizeValue(player.player);
    const normalizedPlayerNickname = player.player;
    const matchedByPlatformId = usersByPlatformId.get(normalizedPlayerId);
    const matchedByName = matchedByPlatformId
      ? undefined
      : usersByName.get(normalizedPlayerName) ?? usersByName.get(normalizedPlayerNickname);
    const matchedUser = matchedByPlatformId ?? matchedByName;

    console.log("[match-results] import:player-match-attempt", {
      eventId: input.eventIdForLogs,
      externalPlayerId: player.player_id,
      externalPlayerName: player.player,
      normalizedPlayerId,
      normalizedPlayerName,
      normalizedPlayerNickname,
      team: player.team.side,
      stats: {
        kills: player.kills,
        deaths: player.deaths,
        killDeathRatio: player.kill_death_ratio,
        offense: player.offense,
        defense: player.defense,
        support: player.support,
      },
      matchedBy: matchedByPlatformId ? "platformId" : matchedByName ? "nickname" : "none",
      matchedUser: matchedUser ? {
        userId: matchedUser.id,
        name: matchedUser.name,
        platformId: matchedUser.platformId,
        normalizedName: matchedUser.name,
      } : null,
    });

    if (!matchedUser) {
      console.log("[match-results] import:player-skipped", {
        eventId: input.eventIdForLogs,
        externalPlayerId: player.player_id,
        externalPlayerName: player.player,
        reason: "no-clan-match",
      });
      return [];
    }

    if (player.team.side === "axis" || player.team.side === "allies") {
      sideCounts[player.team.side] += 1;
    }

    return [{
      id: player.player_id,
      userId: matchedUser.id,
      latestName: player.player,
      match: {
        sourceUrl: input.sourceUrl,
        importedAt,
        endedAt: input.payload.end,
        mapId: input.mapId,
        mapName: input.payload.map.pretty_name,
        playerName: player.player,
        userId: matchedUser.id,
        team: player.team.side,
        kills: player.kills,
        killDeathRatio: player.kill_death_ratio,
        deaths: player.deaths,
        offense: player.offense,
        defense: player.defense,
        support: player.support,
      },
    }] satisfies PreparedPlayerImport[];
  });

  const inferredEventSide: "axis" | "allies" | undefined = sideCounts.axis === sideCounts.allies
    ? undefined
    : sideCounts.axis > sideCounts.allies
      ? "axis"
      : "allies";

  return {
    entries,
    inferredEventSide,
    importedUserIds: [...new Set(entries.map((entry) => entry.userId))],
  };
}

function buildImportedEventInput(input: {
  payload: ScoreboardResponse["result"];
  sourceUrl: string;
  inferredEventSide?: "axis" | "allies";
}) {
  const payload = input.payload;
  const startAt = parseDate(payload.start) ?? parseDate(payload.end) ?? parseDate(payload.creation_time) ?? new Date();
  const endAt = parseDate(payload.end) ?? startAt;
  const registrationEnd = parseDate(payload.creation_time) ?? startAt;
  const safeRegistrationEnd = registrationEnd.getTime() > startAt.getTime() ? startAt : registrationEnd;
  const safeGameEnd = endAt.getTime() < startAt.getTime() ? startAt : endAt;
  const mapName = payload.map.pretty_name || payload.map_name || "-";
  const gameMode = payload.map.game_mode || "-";
  const eventName = `${mapName} #${payload.id}`;

  return {
    name: eventName,
    description: `Imported from ${input.sourceUrl}`,
    server: Number.isFinite(payload.server_number) ? `Server ${payload.server_number}` : "-",
    serverPassword: "-",
    side: input.inferredEventSide ?? "-",
    map: mapName,
    cap: gameMode,
    notes: `Imported match ${payload.id} from ${input.sourceUrl}${payload.map.environment ? ` (${payload.map.environment})` : ""}`,
    registrationEnd: toIsoString(safeRegistrationEnd, startAt),
    meetingStart: toIsoString(startAt, startAt),
    gameStart: toIsoString(startAt, startAt),
    gameEnd: toIsoString(safeGameEnd, startAt),
    pingClan: false,
  };
}

export async function importEventMatchResults(input: {
  serverId: string;
  eventId: string;
  eventSide?: string;
  matchLink: string;
}) {
  const { apiUrl, mapId, sourceUrl, payload } = await fetchScoreboard(input.matchLink);
  console.log("[match-results] import:start", {
    serverId: input.serverId,
    eventId: input.eventId,
    eventSide: input.eventSide,
    sourceUrl,
    apiUrl,
    mapId,
  });
  console.log("[match-results] import:payload", {
    eventId: input.eventId,
    mapId,
    mapName: payload.result.map.pretty_name,
    endedAt: payload.result.end,
    importedPlayers: payload.result.player_stats.length,
    score: payload.result.result,
  });

  const preparedImport = await preparePlayerImports({
    serverId: input.serverId,
    payload: payload.result,
    sourceUrl,
    mapId,
    eventIdForLogs: input.eventId,
  });

  await savePlayerMatchStats({
    entries: preparedImport.entries.map((entry) => ({
      ...entry,
      eventId: input.eventId,
    })),
  });
  console.log("[match-results] import:player-stats-saved", {
    eventId: input.eventId,
    savedCount: preparedImport.entries.length,
    savedPlayers: preparedImport.entries.map((entry) => ({
      externalId: entry.id,
      userId: entry.userId,
      latestName: entry.latestName,
    })),
  });

  const resolvedEventSide = input.eventSide ?? preparedImport.inferredEventSide;
  const eventResult = buildEventResult(resolvedEventSide, sourceUrl, mapId, payload.result);
  console.log("[match-results] import:event-result", {
    eventId: input.eventId,
    eventSide: resolvedEventSide,
    resolved: Boolean(eventResult),
    eventResult,
  });
  if (eventResult) {
    await saveServerEventResult({
      eventId: input.eventId,
      eventResult,
    });
  }

  const summary = {
    importedPlayers: preparedImport.entries.length,
    importedUserIds: preparedImport.importedUserIds,
    eventResultSaved: Boolean(eventResult),
  };
  console.log("[match-results] import:complete", {
    eventId: input.eventId,
    summary,
  });

  return summary;
}

export async function importServerEventsFromLinks(input: {
  serverId: string;
  linksInput: string;
}) {
  const links = normalizeImportedEventLinks(input.linksInput);
  if (links.length === 0) {
    throw new Error("Please provide at least one match link.");
  }

  const importedUserIds = new Set<string>();
  const errors: Array<{ link: string; error: string }> = [];
  let importedEvents = 0;
  let importedPlayers = 0;
  let eventResultsSaved = 0;

  for (const link of links) {
    try {
      const { mapId, sourceUrl, payload } = await fetchScoreboard(link);
      console.log("[match-results] bulk-import:payload", {
        serverId: input.serverId,
        mapId,
        sourceUrl,
        importedPlayers: payload.result.player_stats.length,
      });

      const preparedImport = await preparePlayerImports({
        serverId: input.serverId,
        payload: payload.result,
        sourceUrl,
        mapId,
        eventIdForLogs: `import:${mapId}`,
      });
      const inferredEventSide = preparedImport.inferredEventSide;

      const eventId = await saveServerEvent({
        serverId: input.serverId,
        ...buildImportedEventInput({
          payload: payload.result,
          sourceUrl,
          inferredEventSide,
        }),
      });

      await savePlayerMatchStats({
        entries: preparedImport.entries.map((entry) => ({
          ...entry,
          eventId,
        })),
      });

      const eventResult = buildEventResult(inferredEventSide, sourceUrl, mapId, payload.result);
      if (eventResult) {
        await saveServerEventResult({
          eventId,
          eventResult,
        });
        eventResultsSaved += 1;
      }

      importedEvents += 1;
      importedPlayers += preparedImport.entries.length;
      preparedImport.importedUserIds.forEach((userId) => importedUserIds.add(userId));
    } catch (error) {
      errors.push({
        link,
        error: error instanceof Error ? error.message : "Unable to import this event.",
      });
    }
  }

  if (importedEvents === 0) {
    throw new Error(errors[0]?.error ?? "Unable to import any events.");
  }

  return {
    importedEvents,
    importedPlayers,
    eventResultsSaved,
    importedUserIds: [...importedUserIds],
    failedLinks: errors,
  };
}

export async function autoLinkPlatformIdsFromEventImports(input: {
  serverId: string;
  clanTag: string;
  sourceUrls: string[];
}) {
  const sourceUrls = [...new Set(input.sourceUrls.map((url) => url.trim()).filter(Boolean))];
  if (sourceUrls.length === 0) {
    return {
      scannedEvents: 0,
      scannedPlayers: 0,
      matchedPlayers: 0,
      linkedUsers: 0,
      alreadyLinkedUsers: 0,
      ambiguousUsers: 0,
      conflictedUsers: 0,
      failedEvents: 0,
    };
  }

  const assignments = await getServerUserAssignments(input.serverId);
  const assignedUsers = await getUsersByIds(assignments.map((assignment) => assignment.userId));
  const allUsers = await listUsers();
  const uniqueUsersByName = buildUniqueUserMap(assignedUsers);
  const existingPlatformOwnerById = new Map(
    allUsers
      .filter((user) => user.platformId)
      .map((user) => [normalizeValue(user.platformId), user.id] as const),
  );

  const candidateIdsByUserId = new Map<string, Set<string>>();
  let scannedPlayers = 0;
  let matchedPlayers = 0;
  let failedEvents = 0;

  for (const sourceUrl of sourceUrls) {
    try {
      const { payload } = await fetchScoreboard(sourceUrl);
      for (const player of payload.result.player_stats) {
        scannedPlayers += 1;

        const strippedName = stripClanTag(player.player, input.clanTag);
        if (!strippedName) {
          continue;
        }

        const matchedUser = uniqueUsersByName.get(normalizeValue(strippedName));
        if (!matchedUser) {
          continue;
        }

        matchedPlayers += 1;
        const normalizedPlayerId = normalizeValue(player.player_id);
        if (!normalizedPlayerId) {
          continue;
        }

        const candidateIds = candidateIdsByUserId.get(matchedUser.id) ?? new Set<string>();
        candidateIds.add(normalizedPlayerId);
        candidateIdsByUserId.set(matchedUser.id, candidateIds);
      }
    } catch (error) {
      failedEvents += 1;
      console.error("[match-results] auto-link:failed-event", {
        serverId: input.serverId,
        sourceUrl,
        error,
      });
    }
  }

  let linkedUsers = 0;
  let alreadyLinkedUsers = 0;
  let ambiguousUsers = 0;
  let conflictedUsers = 0;

  for (const user of assignedUsers) {
    const candidateIds = candidateIdsByUserId.get(user.id);
    if (!candidateIds || candidateIds.size === 0) {
      continue;
    }

    if (candidateIds.size > 1) {
      ambiguousUsers += 1;
      continue;
    }

    const [candidateId] = [...candidateIds];
    const existingPlatformId = normalizeValue(user.platformId);

    if (existingPlatformId) {
      if (existingPlatformId === candidateId) {
        alreadyLinkedUsers += 1;
      } else {
        conflictedUsers += 1;
      }
      continue;
    }

    const existingOwnerId = existingPlatformOwnerById.get(candidateId);
    if (existingOwnerId && existingOwnerId !== user.id) {
      conflictedUsers += 1;
      continue;
    }

    try {
      await savePlayerPlatformId({
        userId: user.id,
        platformId: candidateId,
      });
      existingPlatformOwnerById.set(candidateId, user.id);
      linkedUsers += 1;
    } catch (error) {
      conflictedUsers += 1;
      console.error("[match-results] auto-link:failed-save", {
        serverId: input.serverId,
        userId: user.id,
        candidateId,
        error,
      });
    }
  }

  return {
    scannedEvents: sourceUrls.length,
    scannedPlayers,
    matchedPlayers,
    linkedUsers,
    alreadyLinkedUsers,
    ambiguousUsers,
    conflictedUsers,
    failedEvents,
  };
}
