import { fetchMutation } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";

const upsertEventReference = makeFunctionReference<"mutation">("events:upsert");
const concludeEventReference = makeFunctionReference<"mutation">("events:conclude");
const setEventResultReference = makeFunctionReference<"mutation">("events:setResult");
const toggleSignupReference = makeFunctionReference<"mutation">("events:toggleSignUp");

export async function saveServerEventCommand(input: {
  eventId?: string;
  serverId: string;
  kind: "match" | "training";
  matchType?: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  meetingChannelId?: string;
  requiredRoleIds?: string[];
  rewardRoleIds?: string[];
  signupGroupIds?: string[];
  useGeneralSignup?: boolean;
  server?: string;
  serverPassword?: string;
  side?: string;
  map?: string;
  cap?: string;
  notes?: string;
  registrationEnd: string;
  meetingStart: string;
  gameStart?: string;
  gameEnd?: string;
  pingClan: boolean;
  createForumChannel: boolean;
  topicPresetId?: string;
  stratmapIds?: string[];
}) {
  return await fetchMutation(upsertEventReference, {
    secret: getInternalAuthSecret(),
    eventId: input.eventId as never,
    serverId: input.serverId,
    kind: input.kind,
    matchType: input.matchType,
    name: input.name,
    description: input.description,
    thumbnailUrl: input.thumbnailUrl,
    meetingChannelId: input.meetingChannelId,
    requiredRoleIds: input.requiredRoleIds,
    rewardRoleIds: input.rewardRoleIds,
    signupGroupIds: input.signupGroupIds,
    useGeneralSignup: input.useGeneralSignup,
    server: input.server,
    serverPassword: input.serverPassword,
    side: input.side,
    map: input.map,
    cap: input.cap,
    notes: input.notes,
    registrationEnd: input.registrationEnd,
    meetingStart: input.meetingStart,
    gameStart: input.gameStart ?? input.meetingStart,
    gameEnd: input.gameEnd ?? input.gameStart ?? input.meetingStart,
    pingClan: input.pingClan,
    createForumChannel: input.createForumChannel,
    topicPresetId: input.topicPresetId as never,
    stratmapIds: input.stratmapIds,
  });
}

export async function concludeServerEventCommand(input: {
  eventId: string;
}) {
  return await fetchMutation(concludeEventReference, {
    secret: getInternalAuthSecret(),
    eventId: input.eventId as never,
  });
}

export async function saveServerEventResultCommand(input: {
  eventId: string;
  eventResult: {
    sourceUrl: string;
    mapId: string;
    mapName?: string;
    endedAt?: string;
    importedAt: string;
    sideA: string;
    sideB: string;
    outcome: "victory" | "defeat" | "draw";
    score: {
      sideA: number;
      sideB: number;
    };
  };
}) {
  return await fetchMutation(setEventResultReference, {
    secret: getInternalAuthSecret(),
    eventId: input.eventId as never,
    eventResult: input.eventResult,
  });
}

export async function toggleServerEventSignupCommand(input: {
  eventId: string;
  userId: string;
  group: string | null;
}) {
  return await fetchMutation(toggleSignupReference, {
    secret: getInternalAuthSecret(),
    eventId: input.eventId as never,
    userId: input.userId,
    group: input.group,
  });
}
