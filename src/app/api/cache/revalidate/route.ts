import { NextResponse } from "next/server";

import { getLoggedInUser } from "@/lib/auth";
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getInternalAuthSecret } from "@/lib/env";

type AssignmentChangedPayload = {
  type: "assignment-changed";
  serverId: string;
  userId: string;
  assignmentId?: string;
};

type RosterChangedPayload = {
  type: "roster-changed";
  serverId: string;
  rosterId: string;
  eventId?: string;
};

type EventChangedPayload = {
  type: "event-changed";
  serverId: string;
  eventId: string;
};

type DiscordConfigChangedPayload = {
  type: "discord-config-changed";
  serverId: string;
};

type ServerContextChangedPayload = {
  type: "server-context-changed";
  serverId: string;
};

type CacheRevalidationPayload =
  | AssignmentChangedPayload
  | RosterChangedPayload
  | EventChangedPayload
  | DiscordConfigChangedPayload
  | ServerContextChangedPayload;

function getTagsForPayload(payload: CacheRevalidationPayload) {
  switch (payload.type) {
    case "assignment-changed":
      return [
        appCacheTags.serverContext(payload.serverId),
        appCacheTags.assignments(payload.serverId),
        payload.assignmentId ? appCacheTags.assignment(payload.assignmentId) : undefined,
        appCacheTags.player(payload.userId),
        appCacheTags.users(),
        appCacheTags.rosterImage(),
      ];
    case "roster-changed":
      return [
        appCacheTags.serverContext(payload.serverId),
        appCacheTags.rosters(payload.serverId),
        appCacheTags.roster(payload.rosterId),
        appCacheTags.rosterImage(),
        payload.eventId ? appCacheTags.rosterImageEvent(payload.eventId) : undefined,
      ];
    case "event-changed":
      return [
        appCacheTags.serverContext(payload.serverId),
        appCacheTags.events(payload.serverId),
        appCacheTags.event(payload.eventId),
        appCacheTags.matches(payload.serverId),
      ];
    case "discord-config-changed":
      return [
        appCacheTags.serverContext(payload.serverId),
        appCacheTags.discordConfig(payload.serverId),
      ];
    case "server-context-changed":
      return [appCacheTags.serverContext(payload.serverId)];
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parsePayload(body: unknown): CacheRevalidationPayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const payload = body as Record<string, unknown>;
  if (!isNonEmptyString(payload.type) || !isNonEmptyString(payload.serverId)) {
    return null;
  }

  switch (payload.type) {
    case "assignment-changed":
      if (!isNonEmptyString(payload.userId)) {
        return null;
      }
      return {
        type: "assignment-changed",
        serverId: payload.serverId,
        userId: payload.userId,
        assignmentId: isNonEmptyString(payload.assignmentId) ? payload.assignmentId : undefined,
      };
    case "roster-changed":
      if (!isNonEmptyString(payload.rosterId)) {
        return null;
      }
      return {
        type: "roster-changed",
        serverId: payload.serverId,
        rosterId: payload.rosterId,
        eventId: isNonEmptyString(payload.eventId) ? payload.eventId : undefined,
      };
    case "event-changed":
      if (!isNonEmptyString(payload.eventId)) {
        return null;
      }
      return {
        type: "event-changed",
        serverId: payload.serverId,
        eventId: payload.eventId,
      };
    case "discord-config-changed":
      return {
        type: "discord-config-changed",
        serverId: payload.serverId,
      };
    case "server-context-changed":
      return {
        type: "server-context-changed",
        serverId: payload.serverId,
      };
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | ({ secret?: string; payload?: unknown } & Record<string, unknown>)
    | null;

  const user = await getLoggedInUser();
  const authorized = Boolean(user) || body?.secret === getInternalAuthSecret();
  const payload = parsePayload(body?.payload ?? body);

  if (!authorized || !payload) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  revalidateCacheEntries(getTagsForPayload(payload));
  return NextResponse.json({ ok: true });
}
