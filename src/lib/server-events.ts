import { fetchMutation } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";

const upsertEventReference = makeFunctionReference<"mutation">("events:upsert");
const concludeEventReference = makeFunctionReference<"mutation">("events:conclude");
const setEventResultReference = makeFunctionReference<"mutation">("events:setResult");

export async function saveServerEvent(input: {
  eventId?: string;
  serverId: string;
  name: string;
  description?: string;
  server?: string;
  serverPassword?: string;
  side?: string;
  map?: string;
  cap?: string;
  notes?: string;
  registrationEnd: string;
  meetingStart: string;
  gameStart: string;
  gameEnd: string;
  pingClan: boolean;
  topicPresetId?: string;
}) {
  return await fetchMutation(upsertEventReference, {
    secret: getInternalAuthSecret(),
    eventId: input.eventId as never,
    serverId: input.serverId,
    name: input.name,
    description: input.description,
    server: input.server,
    serverPassword: input.serverPassword,
    side: input.side,
    map: input.map,
    cap: input.cap,
    notes: input.notes,
    registrationEnd: input.registrationEnd,
    meetingStart: input.meetingStart,
    gameStart: input.gameStart,
    gameEnd: input.gameEnd,
    pingClan: input.pingClan,
    topicPresetId: input.topicPresetId as never,
  });
}

export async function concludeServerEvent(input: {
  eventId: string;
}) {
  return await fetchMutation(concludeEventReference, {
    secret: getInternalAuthSecret(),
    eventId: input.eventId as never,
  });
}

export async function saveServerEventResult(input: {
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
