export type PlatformKey = "steam" | "epic" | "xbox" | "playstation" | "other";

const PLATFORM_PREFIX_MAP: Record<string, PlatformKey> = {
  steam: "steam",
  epic: "epic",
  xbox: "xbox",
  xbl: "xbox",
  playstation: "playstation",
  psn: "playstation",
  ps: "playstation",
  other: "other",
};

const STEAM_ID64_REGEX = /^7656119\d{10}$/;
const STEAM_LEGACY_REGEX = /^steam_[0-5]:[01]:\d+$/i;
const EPIC_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EPIC_HEX32_REGEX = /^[0-9a-f]{32}$/i;

function splitPlatformPrefix(value: string) {
  const match = value.trim().match(/^([a-z]+):(.*)$/i);
  if (!match) {
    return null;
  }

  const key = PLATFORM_PREFIX_MAP[match[1].toLowerCase()];
  if (!key) {
    return null;
  }

  return {
    platform: key,
    rawId: match[2].trim(),
  };
}

export function stripPlatformPrefix(value: string) {
  return splitPlatformPrefix(value)?.rawId ?? value.trim();
}

export function detectPlatformFromId(value: string): PlatformKey {
  const trimmed = value.trim();
  if (!trimmed) {
    return "other";
  }

  const prefixed = splitPlatformPrefix(trimmed);
  if (prefixed) {
    return prefixed.platform;
  }

  const normalized = trimmed.toLowerCase();
  if (STEAM_ID64_REGEX.test(trimmed) || STEAM_LEGACY_REGEX.test(trimmed)) {
    return "steam";
  }

  if (EPIC_UUID_REGEX.test(trimmed) || EPIC_HEX32_REGEX.test(normalized)) {
    return "epic";
  }

  return "other";
}

export function parsePlatformIdsInput(value: string | string[] | undefined | null) {
  const values = Array.isArray(value) ? value : [value ?? ""];

  return [...new Set(
    values
      .flatMap((entry) => entry.split(","))
      .map((entry) => stripPlatformPrefix(entry).replace(/\s+/g, "").trim())
      .filter(Boolean),
  )];
}

export function formatPlatformIds(value: string[] | undefined | null) {
  return value?.length ? value.map((entry) => stripPlatformPrefix(entry)).join(", ") : "";
}

export function getPlatformLabel(platform: PlatformKey, labels: Record<PlatformKey, string>) {
  return labels[platform];
}

export function getPlatformProfileUrl(platformId: string) {
  const rawId = stripPlatformPrefix(platformId);
  const platform = detectPlatformFromId(platformId);

  if (platform === "steam" && STEAM_ID64_REGEX.test(rawId)) {
    return `https://steamcommunity.com/profiles/${rawId}`;
  }

  return undefined;
}

export function describePlatformId(platformId: string, labels: Record<PlatformKey, string>) {
  const rawId = stripPlatformPrefix(platformId);
  const platform = detectPlatformFromId(platformId);
  return {
    value: platformId,
    rawId,
    platform,
    label: getPlatformLabel(platform, labels),
    profileUrl: getPlatformProfileUrl(platformId),
  };
}

export function describePlatformIds(platformIds: string[] | undefined | null, labels: Record<PlatformKey, string>) {
  return (platformIds ?? []).map((platformId) => describePlatformId(platformId, labels));
}
