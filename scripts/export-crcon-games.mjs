#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

const BASE_URL = "https://event.valkyriahll.app";
const PAGE_SIZE = 100;
const MIN_DURATION_SECONDS = 35 * 60;
const MIN_PLAYERS = 98;
const OUTPUT_PATH = new URL("../out.txt", import.meta.url);
const REQUEST_DELAY_MS = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "logi-crcon-export/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  return await response.json();
}

function getDurationSeconds(scoreboard) {
  const start = Date.parse(scoreboard.start);
  const end = Date.parse(scoreboard.end);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }

  return Math.floor((end - start) / 1000);
}

function getPlayerCount(scoreboard) {
  if (!Array.isArray(scoreboard.player_stats)) {
    return 0;
  }

  const uniquePlayerIds = new Set(
    scoreboard.player_stats
      .map((player) => String(player?.player_id ?? "").trim())
      .filter(Boolean),
  );

  return uniquePlayerIds.size;
}

async function getAllMapIds() {
  const ids = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${BASE_URL}/api/get_scoreboard_maps?page=${page}&page_size=${PAGE_SIZE}`;
    const payload = await fetchJson(url);
    const result = payload?.result;
    const maps = Array.isArray(result?.maps) ? result.maps : [];
    const total = Number(result?.total ?? maps.length);

    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    for (const entry of maps) {
      if (entry?.id != null) {
        ids.push(String(entry.id));
      }
    }

    page += 1;
  }

  return ids;
}

async function getQualifiedGameUrls() {
  const mapIds = await getAllMapIds();
  const qualifiedUrls = [];

  for (let index = 0; index < mapIds.length; index += 1) {
    const mapId = mapIds[index];
    const url = `${BASE_URL}/api/get_map_scoreboard?map_id=${encodeURIComponent(mapId)}`;
    const payload = await fetchJson(url);
    const scoreboard = payload?.result;

    if (!scoreboard) {
      continue;
    }

    const durationSeconds = getDurationSeconds(scoreboard);
    const playerCount = getPlayerCount(scoreboard);

    if (durationSeconds > MIN_DURATION_SECONDS && playerCount >= MIN_PLAYERS) {
      qualifiedUrls.push(`${BASE_URL}/games/${mapId}`);
    }

    if (REQUEST_DELAY_MS > 0) {
      await sleep(REQUEST_DELAY_MS);
    }

    if ((index + 1) % 50 === 0 || index === mapIds.length - 1) {
      console.log(`Processed ${index + 1}/${mapIds.length}`);
    }
  }

  return qualifiedUrls;
}

async function main() {
  const qualifiedUrls = await getQualifiedGameUrls();
  const output = qualifiedUrls.join("\n") + (qualifiedUrls.length ? "\n" : "");

  await writeFile(OUTPUT_PATH, output, "utf8");

  console.log(`Wrote ${qualifiedUrls.length} game URLs to ${OUTPUT_PATH.pathname}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
