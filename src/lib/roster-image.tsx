import { cacheLife, cacheTag } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

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

const getRosterImageContextReference = makeFunctionReference<"query">("discord:getRosterImageContext");

export async function getRosterImageContext(eventId: string) {
  return (await fetchQuery(getRosterImageContextReference, {
    secret: getInternalAuthSecret(),
    eventId: eventId as never,
  })) as RosterImageContext | null;
}

export async function getRosterImageContextCached(eventId: string) {
  "use cache";

  cacheLife("hours");
  cacheTag(`roster-image:v3:${eventId}`);

  return getRosterImageContext(eventId);
}

export function buildRosterImageUrl(eventId: string) {
  const url = new URL(`/api/discord/roster-image/${eventId}`, getSiteUrl());
  url.searchParams.set("secret", getInternalAuthSecret());
  return url.toString();
}
