import assert from "node:assert/strict";
import test from "node:test";

import { eventSchema } from "@/lib/validation/event";

import {
  createServerEventPatchHandler,
  createServerEventPostHandler,
  createServerEventsPostHandler,
} from "./event-route-handlers";

function createDeps() {
  const calls = {
    revalidated: [] as string[][],
    savedEvents: [] as Array<Record<string, unknown>>,
    concluded: [] as Array<{ eventId: string }>,
    importedEventLinks: [] as Array<{ serverId: string; linksInput: string }>,
    importedMatchResults: [] as Array<{ serverId: string; eventId: string; eventSide?: string; matchLink: string }>,
    requestedMetadata: [] as string[],
    logged: [] as Array<{ scope: string; error: unknown }>,
  };

  return {
    calls,
    deps: {
      eventSchema,
      saveServerEvent: async (input: Record<string, unknown>) => {
        calls.savedEvents.push(input);
        return String(input.eventId ?? "event-1");
      },
      concludeServerEvent: async (input: { eventId: string }) => {
        calls.concluded.push(input);
      },
      importServerEventsFromLinks: async (input: { serverId: string; linksInput: string }) => {
        calls.importedEventLinks.push(input);
        return {
          importedUserIds: ["user-1"],
          linkReports: [{ eventId: "event-1" }, { eventId: undefined }],
          importedEvents: 1,
        };
      },
      importEventMatchResults: async (input: { serverId: string; eventId: string; eventSide?: string; matchLink: string }) => {
        calls.importedMatchResults.push(input);
        return {
          importedUserIds: ["user-1", "user-2"],
          importedPlayers: 2,
        };
      },
      getEventMetadata: async (eventId: string): Promise<{ side?: string } | null> => {
        calls.requestedMetadata.push(eventId);
        return { side: "allies" };
      },
      revalidateCacheEntries: (tags: Array<string | null | undefined | false>) => {
        calls.revalidated.push(tags.filter((tag): tag is string => Boolean(tag)));
      },
      appCacheTags: {
        serverContext: (serverId: string) => `server-context:${serverId}`,
        events: (serverId: string) => `events:${serverId}`,
        event: (eventId: string) => `event:${eventId}`,
        rosterImageEvent: (eventId: string) => `roster-image:${eventId}`,
        matches: (serverId: string) => `matches:${serverId}`,
        match: (eventId: string) => `match:${eventId}`,
        rosters: (serverId: string) => `rosters:${serverId}`,
        player: (userId: string) => `player:${userId}`,
        playerStats: (userId: string) => `player-stats:${userId}`,
        users: () => "users",
      },
      logRouteError: (scope: string, error: unknown) => {
        calls.logged.push({ scope, error });
      },
      getUserSafeErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
    },
  };
}

function createEventBody(overrides: Record<string, unknown> = {}) {
  return {
    kind: "match",
    name: "Test Event",
    registrationEnd: "2026-07-23T10:00:00.000Z",
    meetingStart: "2026-07-23T11:00:00.000Z",
    gameStart: "2026-07-23T12:00:00.000Z",
    gameEnd: "2026-07-23T14:00:00.000Z",
    pingClan: false,
    ...overrides,
  };
}

test("server events POST saves validated events and revalidates cache tags", async () => {
  const { deps, calls } = createDeps();
  const handler = createServerEventsPostHandler(deps);

  const response = await handler(
    { json: async () => createEventBody({ topicPresetId: "" }) },
    { params: Promise.resolve({ serverId: "guild-1" }) },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { eventId: "event-1" });
  assert.equal(calls.savedEvents.length, 1);
  assert.deepEqual(calls.savedEvents[0]?.topicPresetId, undefined);
  assert.deepEqual(calls.revalidated[0], [
    "server-context:guild-1",
    "events:guild-1",
    "event:event-1",
    "roster-image:event-1",
  ]);
});

test("server events POST imports events and revalidates imported entity tags", async () => {
  const { deps, calls } = createDeps();
  const handler = createServerEventsPostHandler(deps);

  const response = await handler(
    { json: async () => ({ action: "importEvents", links: "https://example.com/games/123" }) },
    { params: Promise.resolve({ serverId: "guild-1" }) },
  );

  assert.equal(response.status, 200);
  assert.equal(calls.importedEventLinks.length, 1);
  assert.deepEqual(calls.revalidated[0], [
    "server-context:guild-1",
    "events:guild-1",
    "matches:guild-1",
    "event:event-1",
    "match:event-1",
    "roster-image:event-1",
    "player:user-1",
    "player-stats:user-1",
    "users",
  ]);
});

test("server events POST returns a safe validation error response", async () => {
  const { deps, calls } = createDeps();
  const handler = createServerEventsPostHandler(deps);

  const response = await handler(
    { json: async () => createEventBody({ meetingStart: "bad-date" }) },
    { params: Promise.resolve({ serverId: "guild-1" }) },
  );

  assert.equal(response.status, 400);
  assert.equal(calls.logged[0]?.scope, "events.create");
  assert.match(String((await response.json()).error), /Unable to save the event|Meeting start/);
});

test("server event PATCH updates an event and revalidates the updated tags", async () => {
  const { deps, calls } = createDeps();
  const handler = createServerEventPatchHandler(deps);

  const response = await handler(
    { json: async () => createEventBody({ name: "Updated Event" }) },
    { params: Promise.resolve({ serverId: "guild-1", eventId: "event-9" }) },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { eventId: "event-9" });
  assert.equal(calls.savedEvents[0]?.eventId, "event-9");
  assert.deepEqual(calls.revalidated[0], [
    "server-context:guild-1",
    "events:guild-1",
    "event:event-9",
    "roster-image:event-9",
  ]);
});

test("server event POST concludes an event", async () => {
  const { deps, calls } = createDeps();
  const handler = createServerEventPostHandler(deps);

  const response = await handler(
    { json: async () => ({ action: "conclude" }) },
    { params: Promise.resolve({ serverId: "guild-1", eventId: "event-1" }) },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(calls.concluded, [{ eventId: "event-1" }]);
});

test("server event POST submits match results and revalidates related caches", async () => {
  const { deps, calls } = createDeps();
  const handler = createServerEventPostHandler(deps);

  const response = await handler(
    { json: async () => ({ action: "submitMatchResults", matchLink: "https://example.com/games/123" }) },
    { params: Promise.resolve({ serverId: "guild-1", eventId: "event-1" }) },
  );

  assert.equal(response.status, 200);
  assert.equal(calls.requestedMetadata[0], "event-1");
  assert.deepEqual(calls.importedMatchResults[0], {
    serverId: "guild-1",
    eventId: "event-1",
    eventSide: "allies",
    matchLink: "https://example.com/games/123",
  });
  assert.deepEqual(calls.revalidated[0], [
    "server-context:guild-1",
    "events:guild-1",
    "event:event-1",
    "matches:guild-1",
    "match:event-1",
    "rosters:guild-1",
    "roster-image:event-1",
    "player:user-1",
    "player-stats:user-1",
    "users",
    "player:user-2",
    "player-stats:user-2",
    "users",
  ]);
});

test("server event POST returns 404 for missing metadata and 400 for unsupported actions", async () => {
  const { deps } = createDeps();
  deps.getEventMetadata = async () => null;
  const handler = createServerEventPostHandler(deps);

  const notFound = await handler(
    { json: async () => ({ action: "submitMatchResults", matchLink: "https://example.com/games/123" }) },
    { params: Promise.resolve({ serverId: "guild-1", eventId: "event-1" }) },
  );
  assert.equal(notFound.status, 404);
  assert.deepEqual(await notFound.json(), { error: "Event not found." });

  const unsupported = await handler(
    { json: async () => ({ action: "somethingElse" }) },
    { params: Promise.resolve({ serverId: "guild-1", eventId: "event-1" }) },
  );
  assert.equal(unsupported.status, 400);
  assert.deepEqual(await unsupported.json(), { error: "Unsupported action." });
});
