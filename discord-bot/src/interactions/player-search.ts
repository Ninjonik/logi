export type PlayerSearchResult = {
  playerId: string;
  playerName: string;
};

type StatsPlayerRecord = {
  player_id?: unknown;
  soldier?: {
    name?: unknown;
    platform?: unknown;
  } | null;
  names?: Array<{
    name?: unknown;
  }> | null;
};

type StatsSearchResponse = {
  result?: {
    players?: StatsPlayerRecord[];
  } | null;
};

export function extractPlayerSearchResults(payload: unknown): PlayerSearchResult[] {
  const players = ((payload as StatsSearchResponse | null | undefined)?.result?.players ?? []);
  if (!Array.isArray(players)) {
    return [];
  }

  return players.flatMap((player) => {
    const playerId = typeof player.player_id === "string" ? player.player_id.trim() : "";
    const soldierName = typeof player.soldier?.name === "string" ? player.soldier.name.trim() : "";
    const fallbackName = Array.isArray(player.names)
      ? (() => {
        const match = player.names.find((entry) => typeof entry?.name === "string" && entry.name.trim());
        return typeof match?.name === "string" ? match.name.trim() : "";
      })()
      : "";
    const playerName = soldierName || fallbackName;

    if (!playerId || !playerName) {
      return [];
    }

    return [{ playerId, playerName }];
  });
}

export function detectPlatformFromStatsId(value: string): "steam" | "epic" | "xbox" | "playstation" | "other" {
  const trimmed = value.trim();
  if (/^7656119\d{10}$/.test(trimmed) || /^steam_[0-5]:[01]:\d+$/i.test(trimmed)) {
    return "steam";
  }
  if (/^[0-9a-f]{32}$/i.test(trimmed) || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return "epic";
  }
  return "other";
}
