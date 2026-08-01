import { availableParallelism, cpus } from "node:os";

import { saveServerEvent, saveServerEventResult } from "@/lib/server-events";
import { getGuildMetadata } from "@/lib/server-metadata";
import { saveServerMatch } from "@/lib/server-matches";
import {
  getServerUserAssignments,
  getUsersByIds,
  linkImportedDiscordProfile,
  listUsersUncached,
  reassignImportedMember,
  saveImportedClanMember,
  savePlayerPlatformId,
  upsertImportedPlayer,
} from "@/lib/server-user-management";
import { savePlayerMatchStats } from "@/lib/server-player-stats";

type ExternalTeam = string;

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

type ImportProgress = {
  phase: "queued" | "fetching" | "importing" | "completed";
  total: number;
  fetched: number;
  processed: number;
  successful: number;
  failed: number;
  percent: number;
  currentLink?: string;
};

type FetchedScoreboardResult =
  | {
      ok: true;
      link: string;
      fetched: Awaited<ReturnType<typeof fetchScoreboard>>;
    }
  | {
      ok: false;
      link: string;
      error: string;
    };

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toLoggedError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function logImportError(scope: string, context: Record<string, unknown>, error: unknown) {
  console.error(`[match-results] ${scope}`, {
    ...context,
    error: toLoggedError(error),
  });
}

function normalizeValue(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeComparableName(value: string | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isUnknownTeam(value: string | undefined) {
  const normalized = normalizeValue(value);
  return !normalized || normalized === "unknown";
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

function toImportedUserId(platformId: string) {
  return `imported:${normalizeValue(platformId)}`;
}

function resolveFetchConcurrency(totalLinks: number) {
  const parallelism = typeof availableParallelism === "function"
    ? availableParallelism()
    : cpus().length;

  return Math.max(1, Math.min(totalLinks, parallelism));
}

function calculateImportPercent(progress: Pick<ImportProgress, "total" | "fetched" | "processed">) {
  if (progress.total <= 0) {
    return 0;
  }

  const fetchWeight = 40;
  const importWeight = 60;
  return Math.min(
    100,
    Math.round(
      ((progress.fetched / progress.total) * fetchWeight) +
      ((progress.processed / progress.total) * importWeight),
    ),
  );
}

async function fetchScoreboardsWithProgress(input: {
  links: string[];
  onProgress?: (progress: ImportProgress) => void;
}) {
  const results = new Array<FetchedScoreboardResult>(input.links.length);
  const total = input.links.length;
  const concurrency = resolveFetchConcurrency(total);
  let nextIndex = 0;
  let fetched = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= total) {
        return;
      }

      const link = input.links[index]!;
      try {
        results[index] = {
          ok: true,
          link,
          fetched: await fetchScoreboard(link),
        };
      } catch (error) {
        results[index] = {
          ok: false,
          link,
          error: toErrorMessage(error, "Unable to fetch match results."),
        };
      } finally {
        fetched += 1;
        input.onProgress?.({
          phase: "fetching",
          total,
          fetched,
          processed: 0,
          successful: 0,
          failed: 0,
          percent: calculateImportPercent({ total, fetched, processed: 0 }),
          currentLink: link,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

function buildUniqueUserMap(users: Awaited<ReturnType<typeof getUsersByIds>>) {
  const counts = new Map<string, number>();
  for (const user of users) {
    const normalizedName = normalizeComparableName(user.name);
    if (!normalizedName) {
      continue;
    }
    counts.set(normalizedName, (counts.get(normalizedName) ?? 0) + 1);
  }

  return new Map(
    users.flatMap((user) => {
      const normalizedName = normalizeComparableName(user.name);
      if (!normalizedName || counts.get(normalizedName) !== 1) {
        return [];
      }
      return [[normalizedName, user] as const];
    }),
  );
}

function buildUserNameMap(users: Awaited<ReturnType<typeof listUsersUncached>>) {
  const byName = new Map<string, typeof users>();

  for (const user of users) {
    const normalizedName = normalizeComparableName(user.name);
    if (!normalizedName) {
      continue;
    }

    const existing = byName.get(normalizedName) ?? [];
    existing.push(user);
    byName.set(normalizedName, existing);
  }

  return byName;
}

function resolveImportedUserMatch(input: {
  normalizedPlayerId: string;
  normalizedPlayerName: string;
  usersByPlatformId: Map<string, Awaited<ReturnType<typeof listUsersUncached>>[number]>;
  usersByName: Map<string, Awaited<ReturnType<typeof listUsersUncached>>>;
}) {
  const matchedByPlatformId = input.usersByPlatformId.get(input.normalizedPlayerId);
  if (matchedByPlatformId) {
    return {
      user: matchedByPlatformId,
      byPlatformId: true,
    };
  }

  const matchedByName = input.usersByName.get(input.normalizedPlayerName);
  if (!matchedByName || matchedByName.length !== 1) {
    return {
      user: undefined,
      byPlatformId: false,
    };
  }

  return {
    user: matchedByName[0],
    byPlatformId: false,
  };
}

function canImportExistingUserToServer(user: Awaited<ReturnType<typeof listUsersUncached>>[number], serverDiscordId: string) {
  return !user.guildId || user.guildId === serverDiscordId;
}

function resolveImportedPlayerName(playerName: string, clanTag: string | undefined) {
  if (!clanTag) {
    return playerName.trim() || playerName;
  }

  return stripClanTag(playerName, clanTag) ?? (playerName.trim() || playerName);
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

function resolvePreferredTeamLabel(teamNames: string[], fallback: string) {
  return teamNames.find((teamName) => !isUnknownTeam(teamName)) ?? fallback;
}

function buildEventResult(eventSide: string | undefined, sourceUrl: string, mapId: string, payload: ScoreboardResponse["result"]) {
  const localTeam = resolveLocalTeam(eventSide, payload);
  if (!localTeam) {
    return null;
  }

  const enemyTeam = localTeam === "axis" ? "allies" : "axis";
  const sideA = resolvePreferredTeamLabel([payload.map.map.axis.name, payload.map.map.axis.team], "Side A");
  const sideB = resolvePreferredTeamLabel([payload.map.map.allies.name, payload.map.map.allies.team], "Side B");
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

async function buildServerUserLookups(serverId: string, importPlayers: boolean) {
  const server = await getGuildMetadata(serverId);
  const serverDiscordId = server?.discordId ?? "";
  const assignments = await getServerUserAssignments(serverId);
  const assignedUsers = await getUsersByIds(assignments.map((assignment) => assignment.userId));
  const assignedUserIds = new Set(assignedUsers.map((user) => user.id));
  const allUsers = importPlayers
    ? await listUsersUncached()
    : assignedUsers;
  const nameMatchUsers = importPlayers
    ? allUsers.filter((user) => assignedUserIds.has(user.id) || canImportExistingUserToServer(user, serverDiscordId))
    : assignedUsers;

  const usersByPlatformId = new Map(
    allUsers.flatMap((user) =>
      user.platformIds.map((platformId) => [normalizeValue(platformId), user] as const),
    ),
  );
  const usersByName = buildUserNameMap(nameMatchUsers);

  return { usersByPlatformId, usersByName, serverDiscordId };
}

async function preparePlayerImports(input: {
  serverId: string;
  payload: ScoreboardResponse["result"];
  sourceUrl: string;
  mapId: string;
  eventIdForLogs: string;
  importPlayers?: boolean;
  clanTag?: string;
}) {
  const { usersByPlatformId, usersByName, serverDiscordId } = await buildServerUserLookups(input.serverId, Boolean(input.importPlayers));
  const importedAt = new Date().toISOString();
  const sideCounts = new Map<string, { count: number; value: string }>();
  const importedUserIds = new Set<string>();
  const reassignedUserIds = new Set<string>();
  const entries: PreparedPlayerImport[] = [];

  for (const player of input.payload.player_stats) {
    const normalizedPlayerId = normalizeValue(player.player_id);
    const strippedName = input.clanTag ? stripClanTag(player.player, input.clanTag) : null;
    const importedPlayerName = resolveImportedPlayerName(player.player, input.clanTag);
    const normalizedPlayerName = normalizeComparableName(importedPlayerName);
    const matched = resolveImportedUserMatch({
      normalizedPlayerId,
      normalizedPlayerName,
      usersByPlatformId,
      usersByName,
    });
    let matchedUser = matched.user;

    if (!matchedUser) {
      if (!input.importPlayers || !normalizedPlayerId) {
        continue;
      }

      if (!strippedName) {
        continue;
      }

      const created = await upsertImportedPlayer({
        id: toImportedUserId(normalizedPlayerId),
        name: importedPlayerName,
        platformId: normalizedPlayerId,
      });

      if (created.action === "created" && serverDiscordId) {
        await saveImportedClanMember({
          userId: created.userId,
          serverId: input.serverId,
        });
      }

      matchedUser = {
        id: created.userId,
        discordId: created.userId,
        linkedDiscordId: undefined,
        hasDiscordLink: false,
        platformIds: [normalizedPlayerId],
        name: importedPlayerName,
        avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
        managedGuildIds: [],
        guildId: serverDiscordId || undefined,
        mercenaryGuildIds: [],
        isStreamer: false,
        scores: {},
        createdAt: importedAt,
        updatedAt: importedAt,
      };
      usersByPlatformId.set(normalizedPlayerId, matchedUser);
      usersByName.set(normalizedPlayerName, [matchedUser]);
    } else if (
      input.importPlayers &&
      matched.byPlatformId &&
      serverDiscordId &&
      matchedUser.guildId !== serverDiscordId &&
      !matchedUser.hasDiscordLink &&
      !reassignedUserIds.has(matchedUser.id)
    ) {
      await reassignImportedMember({
        userId: matchedUser.id,
        targetServerId: input.serverId,
      });
      matchedUser.guildId = serverDiscordId;
      reassignedUserIds.add(matchedUser.id);
    } else if (input.importPlayers && normalizedPlayerId && !matchedUser.platformIds.some((platformId: string) => normalizeValue(platformId) === normalizedPlayerId)) {
      await savePlayerPlatformId({
        userId: matchedUser.id,
        platformIds: [...matchedUser.platformIds, normalizedPlayerId],
      });
      matchedUser.platformIds = [...matchedUser.platformIds, normalizedPlayerId];
      usersByPlatformId.set(normalizedPlayerId, matchedUser);
    }

    if (!matchedUser) {
      continue;
    }

    if (!isUnknownTeam(player.team.side)) {
      const normalizedTeamSide = normalizeValue(player.team.side);
      const current = sideCounts.get(normalizedTeamSide);
      sideCounts.set(normalizedTeamSide, {
        count: (current?.count ?? 0) + 1,
        value: current?.value ?? player.team.side,
      });
    }

    entries.push({
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
    });
    importedUserIds.add(matchedUser.id);
  }

  const rankedSides = [...sideCounts.values()].sort((left, right) => right.count - left.count);
  const inferredEventSide = rankedSides.length === 0
    ? undefined
    : rankedSides.length > 1 && rankedSides[0].count === rankedSides[1].count
      ? undefined
      : rankedSides[0].value;

  return {
    entries,
    inferredEventSide,
    importedUserIds: [...importedUserIds],
  };
}

function buildImportedEventInput(input: {
  payload: ScoreboardResponse["result"];
  sourceUrl: string;
  inferredEventSide?: string;
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
  let sourceUrl = input.matchLink;
  let mapId: string | undefined;
  let apiUrl: string | undefined;
  let matchId: number | undefined;

  try {
    const fetched = await fetchScoreboard(input.matchLink);
    ({ apiUrl, mapId, sourceUrl } = fetched);
    const sanitizedPayload = sanitizeScoreboardResult(fetched.payload.result);
    diagnostics.scoreboardFetched = { ok: true };
    matchId = sanitizedPayload.id;

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

    try {
      await saveServerMatch({
        eventId: input.eventId,
        sourceUrl,
        raw: sanitizedPayload,
      });
      diagnostics.matchSaved = { ok: true };
    } catch (error) {
      const message = toErrorMessage(error, "Unable to save raw match.");
      diagnostics.matchSaved = { ok: false, error: message };
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
    if (eventResult) {
      try {
        await saveServerEventResult({
          eventId: input.eventId,
          eventResult,
        });
        diagnostics.eventResultSaved = { ok: true };
      } catch (error) {
        const message = toErrorMessage(error, "Unable to save event result.");
        diagnostics.eventResultSaved = { ok: false, error: message };
        throw error;
      }
    } else {
      diagnostics.eventResultSaved = {
        ok: false,
        error: diagnostics.eventResultPrepared.skippedReason ?? "Event result was not prepared.",
      };
    }

    return {
      importedPlayers: preparedImport.entries.length,
      importedUserIds: preparedImport.importedUserIds,
      matchSaved: diagnostics.matchSaved.ok,
      eventResultSaved: Boolean(eventResult),
      diagnostics,
    };
  } catch (error) {
    logImportError("import:failed", {
      serverId: input.serverId,
      eventId: input.eventId,
      eventSide: input.eventSide,
      matchLink: input.matchLink,
      sourceUrl,
      apiUrl,
      mapId,
      matchId,
      diagnostics,
    }, error);
    throw error;
  }
}

export async function importServerEventsFromLinks(input: {
  serverId: string;
  linksInput: string;
  importPlayers?: boolean;
  clanTag?: string;
  onProgress?: (progress: ImportProgress) => void;
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
  let processed = 0;

  input.onProgress?.({
    phase: "queued",
    total: links.length,
    fetched: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    percent: 0,
  });

  const fetchedResults = await fetchScoreboardsWithProgress({
    links,
    onProgress: input.onProgress,
  });

  for (const fetchedResult of fetchedResults) {
    const link = fetchedResult.link;
    const diagnostics: ImportDiagnostics = {
      scoreboardFetched: { ok: fetchedResult.ok, error: fetchedResult.ok ? undefined : fetchedResult.error },
      playerStatsSaved: { ok: false },
      matchSaved: { ok: false },
      eventResultPrepared: { ok: false },
      eventResultSaved: { ok: false },
    };
    let eventId: string | undefined;
    try {
      if (!fetchedResult.ok) {
        throw new Error(fetchedResult.error);
      }

      const { mapId, sourceUrl, payload } = fetchedResult.fetched;
      const sanitizedPayload = sanitizeScoreboardResult(payload.result);

      const preparedImport = await preparePlayerImports({
        serverId: input.serverId,
        payload: sanitizedPayload,
        sourceUrl,
        mapId,
        eventIdForLogs: `import:${mapId}`,
        importPlayers: input.importPlayers,
        clanTag: input.clanTag,
      });
      const inferredEventSide = preparedImport.inferredEventSide;

      const createdEventId = await saveServerEvent({
        serverId: input.serverId,
        kind: "match",
        createForumChannel: true,
        ...buildImportedEventInput({
          payload: sanitizedPayload,
          sourceUrl,
          inferredEventSide,
        }),
      });
      eventId = createdEventId;

      await savePlayerMatchStats({
        entries: preparedImport.entries.map((entry) => ({
          ...entry,
          eventId: createdEventId,
        })),
      });
      diagnostics.playerStatsSaved = { ok: true };

      await saveServerMatch({
        eventId: createdEventId,
        sourceUrl,
        raw: sanitizedPayload,
      });
      diagnostics.matchSaved = { ok: true };
      matchesSaved += 1;

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
        await saveServerEventResult({
          eventId: createdEventId,
          eventResult,
        });
        diagnostics.eventResultSaved = { ok: true };
        eventResultsSaved += 1;
      } else {
        diagnostics.eventResultSaved = {
          ok: false,
          error: diagnostics.eventResultPrepared.skippedReason ?? "Event result was not prepared.",
        };
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
      logImportError("bulk-import:failed", {
        serverId: input.serverId,
        link,
        eventId,
        importPlayers: Boolean(input.importPlayers),
        clanTag: input.clanTag,
        diagnostics,
      }, error);
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
    } finally {
      processed += 1;
      input.onProgress?.({
        phase: processed === links.length ? "completed" : "importing",
        total: links.length,
        fetched: fetchedResults.length,
        processed,
        successful: importedEvents,
        failed: errors.length,
        percent: processed === links.length ? 100 : calculateImportPercent({
          total: links.length,
          fetched: fetchedResults.length,
          processed,
        }),
        currentLink: link,
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
      linkedUserIds: [] as string[],
      alreadyLinkedUsers: 0,
      ambiguousUsers: 0,
      conflictedUsers: 0,
      failedEvents: 0,
    };
  }

  const assignments = await getServerUserAssignments(input.serverId);
  const assignedUsers = await getUsersByIds(assignments.map((assignment) => assignment.userId));
  const allUsers = await listUsersUncached();
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
      logImportError("auto-link:failed-event", {
        serverId: input.serverId,
        sourceUrl,
      }, error);
    }
  }

  let linkedUsers = 0;
  const linkedUserIds = new Set<string>();
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
          linkedUserIds.add(user.id);
        } catch (error) {
          conflictedUsers += 1;
          logImportError("auto-link:failed-save", {
            serverId: input.serverId,
            userId: user.id,
            candidateId,
          }, error);
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
      linkedUserIds.add(user.id);
    } catch (error) {
      conflictedUsers += 1;
      logImportError("auto-link:failed-save", {
        serverId: input.serverId,
        userId: user.id,
        candidateId,
      }, error);
    }
  }

  return {
    scannedEvents: sourceUrls.length,
    scannedPlayers,
    matchedPlayers,
    linkedUsers,
    linkedUserIds: [...linkedUserIds],
    alreadyLinkedUsers,
    ambiguousUsers,
    conflictedUsers,
    failedEvents,
  };
}

export async function linkMissingDiscordIdsFromRole(input: {
  serverUserIds: string[];
  roleMembers: Array<{
    discordId: string;
    name: string;
    avatar: string;
  }>;
}) {
  const users = await listUsersUncached();
  const serverUserIdSet = new Set(input.serverUserIds);
  const candidates = users.filter((user) => !user.hasDiscordLink && serverUserIdSet.has(user.id));
  const roleMembersByName = new Map<string, typeof input.roleMembers>();

  for (const member of input.roleMembers) {
    const normalizedName = normalizeComparableName(member.name);
    if (!normalizedName) {
      continue;
    }

    const existing = roleMembersByName.get(normalizedName) ?? [];
    existing.push(member);
    roleMembersByName.set(normalizedName, existing);
  }

  let linkedUsers = 0;
  let mergedUsers = 0;
  const linkedUserIds = new Set<string>();

  for (const user of candidates) {
    const match = roleMembersByName.get(normalizeComparableName(user.name))?.[0];
    if (!match) {
      continue;
    }

    const result = await linkImportedDiscordProfile({
      userId: user.id,
      discordId: match.discordId,
      name: match.name,
      avatar: match.avatar,
    });

    linkedUsers += 1;
    if (result.merged) {
      mergedUsers += 1;
    }
    linkedUserIds.add(result.userId);
  }

  return {
    scannedUsers: candidates.length,
    linkedUsers,
    mergedUsers,
    linkedUserIds: [...linkedUserIds],
  };
}
