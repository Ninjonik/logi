import { saveServerEvent, saveServerEventResult } from "@/lib/server-events";
import { saveServerMatch } from "@/lib/server-matches";
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
    game_layout: {
      requested: Array<number | null>;
      set: string[];
    };
    map: {
      id: string;
      pretty_name: string;
      game_mode: string;
      attackers: string | null;
      environment: string;
      image_name: string;
      map: {
        id: string;
        name: string;
        tag: string;
        pretty_name: string;
        shortname: string;
        orientation: string;
        allies: { name: string; team: ExternalTeam };
        axis: { name: string; team: ExternalTeam };
      };
    };
    player_stats: Array<{
      id: number;
      player_id: string;
      player: string;
      map_id: number;
      kill_death_ratio: number;
      kills: number;
      kills_by_type?: Record<string, number>;
      kills_streak: number;
      deaths: number;
      deaths_by_type?: Record<string, number>;
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
        side: ExternalTeam;
        confidence?: "strong" | "mixed";
        ratio?: number;
      };
      level: number;
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

type SanitizedMatchPayload = ScoreboardResponse["result"];

type ImportStageStatus = {
  ok: boolean;
  error?: string;
};

type ImportDiagnostics = {
  scoreboardFetched: ImportStageStatus;
  playerStatsSaved: ImportStageStatus;
  matchSaved: ImportStageStatus;
  eventResultPrepared: ImportStageStatus & {
    skippedReason?: string;
  };
  eventResultSaved: ImportStageStatus;
};

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

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

function sanitizeFieldName(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .trim();

  return normalized || "unknown";
}

function sanitizeRecordKeys(record: Record<string, number> | undefined) {
  const entries = Object.entries(record ?? {});
  const sanitized = new Map<string, number>();

  for (const [key, value] of entries) {
    const safeKey = sanitizeFieldName(key);
    sanitized.set(safeKey, (sanitized.get(safeKey) ?? 0) + value);
  }

  return Object.fromEntries(sanitized);
}

function sanitizeScoreboardResult(payload: ScoreboardResponse["result"]): SanitizedMatchPayload {
  return {
    ...payload,
    game_layout: {
      requested: Array.isArray(payload.game_layout?.requested) ? payload.game_layout.requested : [],
      set: Array.isArray(payload.game_layout?.set) ? payload.game_layout.set : [],
    },
    player_stats: payload.player_stats.map((player) => {
      const { steaminfo: _steaminfo, ...rest } = player as typeof player & { steaminfo?: unknown };
      return {
        ...rest,
        kills_by_type: player.kills_by_type ?? {},
        deaths_by_type: player.deaths_by_type ?? {},
        most_killed: sanitizeRecordKeys(player.most_killed),
        death_by: sanitizeRecordKeys(player.death_by),
        weapons: sanitizeRecordKeys(player.weapons),
        death_by_weapons: sanitizeRecordKeys(player.death_by_weapons),
      };
    }),
  };
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
  console.log("[match-results] fetch:start", {
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

  console.log("[match-results] fetch:success", {
    sourceUrl,
    mapId,
    status: response.status,
    importedPlayers: payload.result.player_stats.length,
    score: payload.result.result,
  });

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
    return "axis";
  }
  if (alliedNames.has(normalizedEventSide)) {
    return "allies";
  }

  return null;
}

function buildEventResult(eventSide: string | undefined, sourceUrl: string, mapId: string, payload: ScoreboardResponse["result"]) {
  const localTeam = resolveLocalTeam(eventSide, payload);
  if (!localTeam) {
    return null;
  }

  const enemyTeam = localTeam === "axis" ? "allies" : "axis";
  const sideA = payload.map.map.axis.name || payload.map.map.axis.team || "Side A";
  const sideB = payload.map.map.allies.name || payload.map.map.allies.team || "Side B";
  const sideAScore = payload.result.axis ?? 0;
  const sideBScore = payload.result.allied ?? 0;
  const localScore = localTeam === "axis" ? sideAScore : sideBScore;
  const enemyScore = enemyTeam === "axis" ? sideAScore : sideBScore;

  return {
    sourceUrl,
    mapId,
    mapName: payload.map.pretty_name,
    endedAt: payload.end,
    importedAt: new Date().toISOString(),
    sideA,
    sideB,
    outcome: localScore === enemyScore ? "draw" as const : localScore > enemyScore ? "victory" as const : "defeat" as const,
    score: {
      sideA: sideAScore,
      sideB: sideBScore,
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
      platformIds: user.platformIds,
      normalizedName: user.name,
    })),
  });

  const usersByPlatformId = new Map(
    users.flatMap((user) =>
      user.platformIds.map((platformId) => [normalizeValue(platformId), user] as const),
    ),
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
        platformIds: matchedUser.platformIds,
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
  const diagnostics: ImportDiagnostics = {
    scoreboardFetched: { ok: false },
    playerStatsSaved: { ok: false },
    matchSaved: { ok: false },
    eventResultPrepared: { ok: false },
    eventResultSaved: { ok: false },
  };

  const { apiUrl, mapId, sourceUrl, payload } = await fetchScoreboard(input.matchLink);
  const sanitizedPayload = sanitizeScoreboardResult(payload.result);
  diagnostics.scoreboardFetched = { ok: true };
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
    mapName: sanitizedPayload.map.pretty_name,
    endedAt: sanitizedPayload.end,
    importedPlayers: sanitizedPayload.player_stats.length,
    score: sanitizedPayload.result,
  });

  const preparedImport = await preparePlayerImports({
    serverId: input.serverId,
    payload: sanitizedPayload,
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
  diagnostics.playerStatsSaved = { ok: true };
  console.log("[match-results] import:player-stats-saved", {
    eventId: input.eventId,
    savedCount: preparedImport.entries.length,
    savedPlayers: preparedImport.entries.map((entry) => ({
      externalId: entry.id,
      userId: entry.userId,
      latestName: entry.latestName,
    })),
  });

  console.log("[match-results] import:match-save:start", {
    eventId: input.eventId,
    sourceUrl,
    matchId: payload.result.id,
  });
  try {
    const savedMatchId = await saveServerMatch({
      eventId: input.eventId,
      sourceUrl,
      raw: sanitizedPayload,
    });
    diagnostics.matchSaved = { ok: true };
    console.log("[match-results] import:match-save:success", {
      eventId: input.eventId,
      sourceUrl,
      matchId: sanitizedPayload.id,
      savedMatchId,
    });
  } catch (error) {
    const message = toErrorMessage(error, "Unable to save raw match.");
    diagnostics.matchSaved = { ok: false, error: message };
    console.error("[match-results] import:match-save:failed", {
      eventId: input.eventId,
      sourceUrl,
      matchId: sanitizedPayload.id,
      error,
    });
    throw error;
  }

  const resolvedEventSide = input.eventSide ?? preparedImport.inferredEventSide;
  const eventResult = buildEventResult(resolvedEventSide, sourceUrl, mapId, sanitizedPayload);
  diagnostics.eventResultPrepared = eventResult
    ? { ok: true }
    : {
        ok: false,
        skippedReason: !resolvedEventSide
          ? "No event side was provided or inferred."
          : `Event side "${resolvedEventSide}" did not match imported teams.`,
      };
  console.log("[match-results] import:event-result", {
    eventId: input.eventId,
    eventSide: resolvedEventSide,
    resolved: Boolean(eventResult),
    eventResult,
    skippedReason: diagnostics.eventResultPrepared.skippedReason,
  });
  if (eventResult) {
    console.log("[match-results] import:event-result-save:start", {
      eventId: input.eventId,
      outcome: eventResult.outcome,
      score: eventResult.score,
    });
    try {
      await saveServerEventResult({
        eventId: input.eventId,
        eventResult,
      });
      diagnostics.eventResultSaved = { ok: true };
      console.log("[match-results] import:event-result-save:success", {
        eventId: input.eventId,
      });
    } catch (error) {
      const message = toErrorMessage(error, "Unable to save event result.");
      diagnostics.eventResultSaved = { ok: false, error: message };
      console.error("[match-results] import:event-result-save:failed", {
        eventId: input.eventId,
        error,
      });
      throw error;
    }
  } else {
    diagnostics.eventResultSaved = {
      ok: false,
      error: diagnostics.eventResultPrepared.skippedReason ?? "Event result was not prepared.",
    };
  }

  const summary = {
    importedPlayers: preparedImport.entries.length,
    importedUserIds: preparedImport.importedUserIds,
    matchSaved: diagnostics.matchSaved.ok,
    eventResultSaved: Boolean(eventResult),
    diagnostics,
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
  const linkReports: Array<{
    link: string;
    eventId?: string;
    importedPlayers?: number;
    matchSaved: boolean;
    eventResultSaved: boolean;
    diagnostics: ImportDiagnostics;
    error?: string;
  }> = [];
  let importedEvents = 0;
  let importedPlayers = 0;
  let eventResultsSaved = 0;
  let matchesSaved = 0;

  for (const link of links) {
    const diagnostics: ImportDiagnostics = {
      scoreboardFetched: { ok: false },
      playerStatsSaved: { ok: false },
      matchSaved: { ok: false },
      eventResultPrepared: { ok: false },
      eventResultSaved: { ok: false },
    };
    let eventId: string | undefined;
    try {
      const { mapId, sourceUrl, payload } = await fetchScoreboard(link);
      const sanitizedPayload = sanitizeScoreboardResult(payload.result);
      diagnostics.scoreboardFetched = { ok: true };
      console.log("[match-results] bulk-import:payload", {
        serverId: input.serverId,
        mapId,
        sourceUrl,
        importedPlayers: sanitizedPayload.player_stats.length,
      });

      const preparedImport = await preparePlayerImports({
        serverId: input.serverId,
        payload: sanitizedPayload,
        sourceUrl,
        mapId,
        eventIdForLogs: `import:${mapId}`,
      });
      const inferredEventSide = preparedImport.inferredEventSide;

      console.log("[match-results] bulk-import:event-save:start", {
        serverId: input.serverId,
        sourceUrl,
        mapId,
      });
      const createdEventId = await saveServerEvent({
        serverId: input.serverId,
        ...buildImportedEventInput({
          payload: sanitizedPayload,
          sourceUrl,
          inferredEventSide,
        }),
      });
      eventId = createdEventId;
      console.log("[match-results] bulk-import:event-save:success", {
        sourceUrl,
        mapId,
        eventId,
      });

      await savePlayerMatchStats({
        entries: preparedImport.entries.map((entry) => ({
          ...entry,
          eventId: createdEventId,
        })),
      });
      diagnostics.playerStatsSaved = { ok: true };
      console.log("[match-results] bulk-import:player-stats-saved", {
        sourceUrl,
        mapId,
        eventId,
        savedCount: preparedImport.entries.length,
      });

      console.log("[match-results] bulk-import:match-save:start", {
        sourceUrl,
        mapId,
        eventId,
        matchId: payload.result.id,
      });
      const savedMatchId = await saveServerMatch({
        eventId: createdEventId,
        sourceUrl,
        raw: sanitizedPayload,
      });
      diagnostics.matchSaved = { ok: true };
      matchesSaved += 1;
      console.log("[match-results] bulk-import:match-save:success", {
        sourceUrl,
        mapId,
        eventId,
        matchId: sanitizedPayload.id,
        savedMatchId,
      });

      const eventResult = buildEventResult(inferredEventSide, sourceUrl, mapId, sanitizedPayload);
      diagnostics.eventResultPrepared = eventResult
        ? { ok: true }
        : {
            ok: false,
            skippedReason: !inferredEventSide
              ? "Could not infer event side from matched clan players."
              : `Inferred side "${inferredEventSide}" did not match imported teams.`,
          };
      if (eventResult) {
        console.log("[match-results] bulk-import:event-result-save:start", {
          sourceUrl,
          mapId,
          eventId,
          outcome: eventResult.outcome,
          score: eventResult.score,
        });
        await saveServerEventResult({
          eventId: createdEventId,
          eventResult,
        });
        diagnostics.eventResultSaved = { ok: true };
        eventResultsSaved += 1;
        console.log("[match-results] bulk-import:event-result-save:success", {
          sourceUrl,
          mapId,
          eventId,
        });
      } else {
        diagnostics.eventResultSaved = {
          ok: false,
          error: diagnostics.eventResultPrepared.skippedReason ?? "Event result was not prepared.",
        };
        console.log("[match-results] bulk-import:event-result-skipped", {
          sourceUrl,
          mapId,
          eventId,
          skippedReason: diagnostics.eventResultPrepared.skippedReason,
        });
      }

      importedEvents += 1;
      importedPlayers += preparedImport.entries.length;
      preparedImport.importedUserIds.forEach((userId) => importedUserIds.add(userId));
      linkReports.push({
        link,
        eventId,
        importedPlayers: preparedImport.entries.length,
        matchSaved: diagnostics.matchSaved.ok,
        eventResultSaved: diagnostics.eventResultSaved.ok,
        diagnostics,
      });
    } catch (error) {
      const message = toErrorMessage(error, "Unable to import this event.");
      console.error("[match-results] bulk-import:failed", {
        serverId: input.serverId,
        link,
        eventId,
        diagnostics,
        error,
      });
      errors.push({
        link,
        error: message,
      });
      linkReports.push({
        link,
        eventId,
        matchSaved: diagnostics.matchSaved.ok,
        eventResultSaved: diagnostics.eventResultSaved.ok,
        diagnostics,
        error: message,
      });
    }
  }

  if (importedEvents === 0) {
    throw new Error(errors[0]?.error ?? "Unable to import any events.");
  }

  return {
    importedEvents,
    importedPlayers,
    matchesSaved,
    eventResultsSaved,
    importedUserIds: [...importedUserIds],
    failedLinks: errors,
    linkReports,
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
    allUsers.flatMap((user) =>
      user.platformIds.map((platformId) => [normalizeValue(platformId), user.id] as const),
    ),
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
    const existingPlatformIds = user.platformIds.map((platformId) => normalizeValue(platformId)).filter(Boolean);
    const existingOwnerId = existingPlatformOwnerById.get(candidateId);

    if (existingOwnerId && existingOwnerId !== user.id) {
      conflictedUsers += 1;
      continue;
    }

    if (existingPlatformIds.length > 0) {
      if (existingPlatformIds.includes(candidateId)) {
        alreadyLinkedUsers += 1;
      } else {
        try {
          await savePlayerPlatformId({
            userId: user.id,
            platformIds: [...user.platformIds, candidateId],
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
      continue;
    }

    try {
      await savePlayerPlatformId({
        userId: user.id,
        platformIds: [candidateId],
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
