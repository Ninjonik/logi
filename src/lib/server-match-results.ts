import { getServerUserAssignments, getUsersByIds } from "@/lib/server-user-management";
import { saveServerEventResult } from "@/lib/server-events";
import { savePlayerMatchStats } from "@/lib/server-player-stats";

type ExternalTeam = "axis" | "allies" | "unknown";

type ScoreboardResponse = {
  failed: boolean;
  error: string | null;
  result: {
    id: number;
    end: string;
    result: {
      axis: number;
      allied: number;
    };
    map: {
      pretty_name: string;
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

function normalizeValue(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
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

export async function importEventMatchResults(input: {
  serverId: string;
  eventId: string;
  eventSide?: string;
  matchLink: string;
}) {
  const { apiUrl, mapId, sourceUrl } = extractMatchIdFromLink(input.matchLink);
  console.log("[match-results] import:start", {
    serverId: input.serverId,
    eventId: input.eventId,
    eventSide: input.eventSide,
    sourceUrl,
    apiUrl,
    mapId,
  });

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
  console.log("[match-results] import:payload", {
    eventId: input.eventId,
    mapId,
    mapName: payload.result.map.pretty_name,
    endedAt: payload.result.end,
    importedPlayers: payload.result.player_stats.length,
    score: payload.result.result,
  });

  const assignments = await getServerUserAssignments(input.serverId);
  const users = await getUsersByIds(assignments.map((assignment) => assignment.userId));
  console.log("[match-results] import:candidate-pool", {
    serverId: input.serverId,
    assignmentCount: assignments.length,
    userCount: users.length,
    users: users.map((user) => ({
      userId: user.id,
      name: user.name,
      steamId: user.steamId,
      normalizedName: user.name,
    })),
  });
  const usersBySteamId = new Map(
    users
      .filter((user) => user.steamId)
      .map((user) => [normalizeValue(user.steamId), user]),
  );
  const usersByName = new Map(
    users.flatMap((user) => {
      const exactName = normalizeValue(user.name);
      const normalizedNickname = user.name;
      const aliases = [...new Set([exactName, normalizedNickname].filter(Boolean))];
      return aliases.map((alias) => [alias, user] as const);
    }),
  );

  const playerEntries = payload.result.player_stats.flatMap((player) => {
    const normalizedPlayerId = normalizeValue(player.player_id);
    const normalizedPlayerName = normalizeValue(player.player);
    const normalizedPlayerNickname = player.player;
    const matchedBySteamId = usersBySteamId.get(normalizedPlayerId);
    const matchedByName = matchedBySteamId
      ? undefined
      : usersByName.get(normalizedPlayerName) ?? usersByName.get(normalizedPlayerNickname);
    const matchedUser = matchedBySteamId ?? matchedByName;

    console.log("[match-results] import:player-match-attempt", {
      eventId: input.eventId,
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
      matchedBy: matchedBySteamId ? "steamId" : matchedByName ? "nickname" : "none",
      matchedUser: matchedUser ? {
        userId: matchedUser.id,
        name: matchedUser.name,
        steamId: matchedUser.steamId,
        normalizedName: matchedUser.name,
      } : null,
    });

    if (!matchedUser) {
      console.log("[match-results] import:player-skipped", {
        eventId: input.eventId,
        externalPlayerId: player.player_id,
        externalPlayerName: player.player,
        reason: "no-clan-match",
      });
      return [];
    }

    return [{
      id: player.player_id,
      userId: matchedUser.id,
      latestName: player.player,
      eventId: input.eventId,
      match: {
        sourceUrl,
        importedAt: new Date().toISOString(),
        endedAt: payload.result.end,
        mapId,
        mapName: payload.result.map.pretty_name,
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
    }];
  });

  await savePlayerMatchStats({
    entries: playerEntries,
  });
  console.log("[match-results] import:player-stats-saved", {
    eventId: input.eventId,
    savedCount: playerEntries.length,
    savedPlayers: playerEntries.map((entry) => ({
      externalId: entry.id,
      userId: entry.userId,
      latestName: entry.latestName,
    })),
  });

  const eventResult = buildEventResult(input.eventSide, sourceUrl, mapId, payload.result);
  console.log("[match-results] import:event-result", {
    eventId: input.eventId,
    eventSide: input.eventSide,
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
    importedPlayers: playerEntries.length,
    importedUserIds: [...new Set(playerEntries.map((entry) => entry.userId).filter((value): value is string => Boolean(value)))],
    eventResultSaved: Boolean(eventResult),
  };
  console.log("[match-results] import:complete", {
    eventId: input.eventId,
    summary,
  });

  return summary;
}
