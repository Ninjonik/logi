import { NextResponse } from "next/server";
import { z } from "zod";
import type { ZodType } from "zod";

type JsonRequest = {
  json(): Promise<unknown>;
};

type EventRouteDeps<TEventInput> = {
  eventSchema: ZodType<TEventInput>;
  saveServerEvent: (input: any) => Promise<string>;
  concludeServerEvent: (input: { eventId: string }) => Promise<void>;
  completeServerTraining: (input: {
    eventId: string;
    participants: Array<{
      userId: string;
      completed: "passed" | "failed";
    }>;
  }) => Promise<void>;
  importServerEventsFromLinks: (input: {
    serverId: string;
    linksInput: string;
    importPlayers?: boolean;
    clanTag?: string;
    onProgress?: (progress: Record<string, unknown>) => void;
  }) => Promise<{
    importedUserIds: string[];
    linkReports: Array<{ eventId?: string }>;
    [key: string]: unknown;
  }>;
  importEventMatchResults: (input: {
    serverId: string;
    eventId: string;
    eventSide?: string;
    matchLink: string;
  }) => Promise<{
    importedUserIds: string[];
    [key: string]: unknown;
  }>;
  getEventMetadata: (eventId: string) => Promise<{
    side?: string;
    rewardRoleIds?: string[];
    name?: string;
  } | null>;
  finalizeTrainingCompletion?: (input: {
    serverId: string;
    eventId: string;
    participants: Array<{
      userId: string;
      completed: "passed" | "failed";
    }>;
  }) => Promise<{
    rewardedUserIds?: string[];
    dmSentUserIds?: string[];
  } | void>;
  revalidateCacheEntries: (tags: Array<string | null | undefined | false>) => void;
  appCacheTags: {
    serverContext(serverId: string): string;
    events(serverId: string): string;
    event(eventId: string): string;
    rosterImageEvent(eventId: string): string;
    matches(serverId: string): string;
    match(eventId: string): string;
    rosters(serverId: string): string;
    assignments(serverId: string): string;
    player(userId: string): string;
    playerStats(userId: string): string;
    publicProfile(userId: string): string;
    publicMatch(eventId: string): string;
    publicDiscovery(): string;
    users(): string;
  };
  logRouteError: (scope: string, error: unknown) => void;
  getUserSafeErrorMessage: (error: unknown, fallback: string) => string;
};

type EventCreateParams = { serverId: string };
type EventActionParams = { serverId: string; eventId: string };

const trainingCompletionSchema = z.object({
  action: z.literal("completeTraining"),
  participants: z.array(z.object({
    userId: z.string().trim().min(1),
    completed: z.union([z.literal("passed"), z.literal("failed")]),
  })).min(1),
});

function buildImportedUserTags(
  importedUserIds: string[],
  appCacheTags: EventRouteDeps<unknown>["appCacheTags"],
) {
  return importedUserIds.flatMap((userId) => [
    appCacheTags.player(userId),
    appCacheTags.playerStats(userId),
    appCacheTags.publicProfile(userId),
    appCacheTags.users(),
  ]);
}

function createImportEventsStream(deps: EventRouteDeps<unknown>, input: {
  serverId: string;
  linksInput: string;
  importPlayers?: boolean;
  clanTag?: string;
}) {
  const encoder = new TextEncoder();

  return new Response(new ReadableStream({
    async start(controller) {
      const emit = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        const result = await deps.importServerEventsFromLinks({
          ...input,
          onProgress: (progress) => emit({ type: "progress", progress }),
        });

        const importedEventIds = result.linkReports
          .map((report) => report.eventId)
          .filter((eventId): eventId is string => Boolean(eventId));

        deps.revalidateCacheEntries([
          deps.appCacheTags.serverContext(input.serverId),
          deps.appCacheTags.events(input.serverId),
          deps.appCacheTags.matches(input.serverId),
          deps.appCacheTags.publicDiscovery(),
          deps.appCacheTags.rosters(input.serverId),
          deps.appCacheTags.assignments(input.serverId),
          ...importedEventIds.flatMap((eventId) => [
            deps.appCacheTags.event(eventId),
            deps.appCacheTags.match(eventId),
            deps.appCacheTags.publicMatch(eventId),
            deps.appCacheTags.rosterImageEvent(eventId),
          ]),
          ...buildImportedUserTags(result.importedUserIds, deps.appCacheTags),
        ]);

        emit({ type: "result", result });
      } catch (error) {
        deps.logRouteError("events.create", error);
        emit({
          type: "error",
          error: deps.getUserSafeErrorMessage(error, "Unable to save the event."),
        });
      } finally {
        controller.close();
      }
    },
  }), {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function createServerEventsPostHandler<TEventInput>(deps: EventRouteDeps<TEventInput>) {
  return async function POST(
    request: JsonRequest,
    { params }: { params: Promise<EventCreateParams> },
  ) {
    try {
      const { serverId } = await params;
      const rawBody = await request.json();

      if ((rawBody as { action?: string } | null | undefined)?.action === "importEvents") {
        const streamProgress = Boolean((rawBody as { streamProgress?: unknown } | null | undefined)?.streamProgress);
        const importInput = {
          serverId,
          linksInput: String((rawBody as { links?: unknown } | null | undefined)?.links ?? ""),
          importPlayers: Boolean((rawBody as { importPlayers?: unknown } | null | undefined)?.importPlayers),
          clanTag: String((rawBody as { clanTag?: unknown } | null | undefined)?.clanTag ?? "").trim() || undefined,
        };

        if (streamProgress) {
          return createImportEventsStream(deps, importInput);
        }

        const result = await deps.importServerEventsFromLinks({
          ...importInput,
        });

        const importedEventIds = result.linkReports
          .map((report) => report.eventId)
          .filter((eventId): eventId is string => Boolean(eventId));

        deps.revalidateCacheEntries([
          deps.appCacheTags.serverContext(serverId),
          deps.appCacheTags.events(serverId),
          deps.appCacheTags.matches(serverId),
          deps.appCacheTags.publicDiscovery(),
          deps.appCacheTags.rosters(serverId),
          deps.appCacheTags.assignments(serverId),
          ...importedEventIds.flatMap((eventId) => [
            deps.appCacheTags.event(eventId),
            deps.appCacheTags.match(eventId),
            deps.appCacheTags.publicMatch(eventId),
            deps.appCacheTags.rosterImageEvent(eventId),
          ]),
          ...buildImportedUserTags(result.importedUserIds, deps.appCacheTags),
        ]);

        return NextResponse.json(result);
      }

      const body = deps.eventSchema.parse(rawBody) as Record<string, unknown>;
      const eventId = await deps.saveServerEvent({
        serverId,
        ...body,
        topicPresetId: body.topicPresetId || undefined,
      });

      deps.revalidateCacheEntries([
        deps.appCacheTags.serverContext(serverId),
        deps.appCacheTags.events(serverId),
        deps.appCacheTags.event(eventId),
        deps.appCacheTags.rosterImageEvent(eventId),
      ]);

      return NextResponse.json({ eventId });
    } catch (error) {
      deps.logRouteError("events.create", error);
      return NextResponse.json(
        {
          error: deps.getUserSafeErrorMessage(error, "Unable to save the event."),
        },
        { status: 400 },
      );
    }
  };
}

export function createServerEventPatchHandler<TEventInput>(deps: EventRouteDeps<TEventInput>) {
  return async function PATCH(
    request: JsonRequest,
    { params }: { params: Promise<EventActionParams> },
  ) {
    try {
      const body = deps.eventSchema.parse(await request.json()) as Record<string, unknown>;
      const { serverId, eventId } = await params;
      const updatedEventId = await deps.saveServerEvent({
        eventId,
        serverId,
        ...body,
        topicPresetId: body.topicPresetId || undefined,
      });

      deps.revalidateCacheEntries([
        deps.appCacheTags.serverContext(serverId),
        deps.appCacheTags.events(serverId),
        deps.appCacheTags.event(updatedEventId),
        deps.appCacheTags.rosterImageEvent(updatedEventId),
      ]);

      return NextResponse.json({ eventId: updatedEventId });
    } catch (error) {
      deps.logRouteError("events.update", error);
      return NextResponse.json(
        {
          error: deps.getUserSafeErrorMessage(error, "Unable to save the event."),
        },
        { status: 400 },
      );
    }
  };
}

export function createServerEventPostHandler<TEventInput>(deps: EventRouteDeps<TEventInput>) {
  return async function POST(
    request: JsonRequest,
    { params }: { params: Promise<EventActionParams> },
  ) {
    try {
      const body = await request.json() as { action?: string; matchLink?: unknown };
      const { serverId, eventId } = await params;

      if (body?.action === "conclude") {
        await deps.concludeServerEvent({ eventId });
        deps.revalidateCacheEntries([
          deps.appCacheTags.serverContext(serverId),
          deps.appCacheTags.events(serverId),
          deps.appCacheTags.event(eventId),
          deps.appCacheTags.rosterImageEvent(eventId),
        ]);
        return NextResponse.json({ ok: true });
      }

      if (body?.action === "completeTraining") {
        const parsed = trainingCompletionSchema.parse(body);
        await deps.completeServerTraining({
          eventId,
          participants: parsed.participants,
        });

        const sideEffects = await deps.finalizeTrainingCompletion?.({
          serverId,
          eventId,
          participants: parsed.participants,
        });

        deps.revalidateCacheEntries([
          deps.appCacheTags.serverContext(serverId),
          deps.appCacheTags.events(serverId),
          deps.appCacheTags.event(eventId),
          deps.appCacheTags.rosterImageEvent(eventId),
          ...buildImportedUserTags(parsed.participants.map((participant) => participant.userId), deps.appCacheTags),
        ]);

        return NextResponse.json({
          ok: true,
          rewardedUsers: sideEffects?.rewardedUserIds?.length ?? 0,
          dmSentUsers: sideEffects?.dmSentUserIds?.length ?? 0,
        });
      }

      if (body?.action === "submitMatchResults") {
        const event = await deps.getEventMetadata(eventId);
        if (!event) {
          return NextResponse.json({ error: "Event not found." }, { status: 404 });
        }

        const result = await deps.importEventMatchResults({
          serverId,
          eventId,
          eventSide: event.side,
          matchLink: String(body.matchLink ?? ""),
        });

        deps.revalidateCacheEntries([
          deps.appCacheTags.serverContext(serverId),
          deps.appCacheTags.events(serverId),
          deps.appCacheTags.event(eventId),
          deps.appCacheTags.matches(serverId),
          deps.appCacheTags.match(eventId),
          deps.appCacheTags.publicMatch(eventId),
          deps.appCacheTags.publicDiscovery(),
          deps.appCacheTags.rosters(serverId),
          deps.appCacheTags.assignments(serverId),
          deps.appCacheTags.rosterImageEvent(eventId),
          ...buildImportedUserTags(result.importedUserIds, deps.appCacheTags),
        ]);
        return NextResponse.json(result);
      }

      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    } catch (error) {
      deps.logRouteError("events.conclude", error);
      return NextResponse.json(
        {
          error: deps.getUserSafeErrorMessage(error, "Unable to process the event action."),
        },
        { status: 400 },
      );
    }
  };
}
