import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { appCacheTags, cachedRead } from "@/lib/cache-tags";
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env";

type RosterImageContext = {
  event: {
    id: string;
    name: string;
    map?: string;
    side?: string;
    meetingStart: string;
    gameStart: string;
    cap?: string;
    notes?: string;
    registrationEnd: string;
    gameEnd: string;
    topicPresetId?: string;
    server?: string;
    serverPassword?: string;
    description?: string;
  };
  roster: {
    updatedAt: string;
    reservePlayerIds: string[];
    notAttendingPlayerIds: string[];
    squads: Array<{
      name: string;
      group: string;
      color: string;
      order: number;
      icon?: string;
      players: Array<{
        id?: string;
        customName?: string;
        ack: boolean;
        confirmed?: boolean;
        roleName?: string;
        roleIcon?: string;
        note?: string;
      }>;
    }>;
  };
  config?: {
    guildId: string;
    timezone: string;
    defaultLanguage: "en" | "cs";
  };
  groups: Array<{
    id: string;
    name: string;
    color: string;
    order: number;
    parentId?: string;
  }>;
  assignments: Array<{
    userId: string;
    primaryGroupId?: string;
    secondaryGroupIds?: string[];
  }>;
  users: Array<{
    id: string;
    discordId: string;
    name: string;
    avatar: string;
    score: number;
  }>;
};

const getRosterImageContextReference = makeFunctionReference<"query">("discordRosters:getRosterImageContext");

export async function getRosterImageContext(eventId: string) {
  return (await fetchQuery(getRosterImageContextReference, {
    secret: getInternalAuthSecret(),
    eventId: eventId as never,
  })) as RosterImageContext | null;
}

export async function getRosterImageContextCached(eventId: string) {
  return await cachedRead(["roster-image", eventId], [appCacheTags.rosterImage(), appCacheTags.rosterImageEvent(eventId)], () => getRosterImageContext(eventId), 3600);
}

function buildRosterImageCacheKey(eventId: string, rosterUpdatedAt?: string) {
  const versionSource = rosterUpdatedAt ? `${eventId}:${rosterUpdatedAt}` : `${eventId}:${Date.now()}`;
  return Buffer.from(versionSource).toString("base64url");
}

export function resolveSiteAssetUrl(path?: string) {
  if (!path) return undefined;

  try {
    return new URL(path, getSiteUrl()).toString();
  } catch {
    return undefined;
  }
}

export function buildRosterImageUrl(eventId: string, rosterUpdatedAt?: string) {
  const url = new URL(`/api/discord/roster-image/${eventId}`, getSiteUrl());
  url.searchParams.set("secret", getInternalAuthSecret());
  url.searchParams.set("cb", buildRosterImageCacheKey(eventId, rosterUpdatedAt));
  return url.toString();
}
