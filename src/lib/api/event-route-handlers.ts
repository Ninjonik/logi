import { NextResponse } from "next/server";
import type { ZodType } from "zod";

type JsonRequest = {
  json(): Promise<unknown>;
};

type EventRouteDeps<TEventInput> = {
  eventSchema: ZodType<TEventInput>;
  saveServerEvent: (input: any) => Promise<string>;
  concludeServerEvent: (input: { eventId: string }) => Promise<void>;
  importServerEventsFromLinks: (input: { serverId: string; linksInput: string }) => Promise<{
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
  getEventMetadata: (eventId: string) => Promise<{ side?: string } | null>;
  revalidateCacheEntries: (tags: Array<string | null | undefined | false>) => void;
  appCacheTags: {
    serverContext(serverId: string): string;
    events(serverId: string): string;
    event(eventId: string): string;
    rosterImageEvent(eventId: string): string;
    matches(serverId: string): string;
    match(eventId: string): string;
    rosters(serverId: string): string;
    player(userId: string): string;
    playerStats(userId: string): string;
    users(): string;
  };
  logRouteError: (scope: string, error: unknown) => void;
  getUserSafeErrorMessage: (error: unknown, fallback: string) => string;
};

type EventCreateParams = { serverId: string };
type EventActionParams = { serverId: string; eventId: string };

function buildImportedUserTags(
  importedUserIds: string[],
  appCacheTags: EventRouteDeps<unknown>["appCacheTags"],
) {
  return importedUserIds.flatMap((userId) => [
    appCacheTags.player(userId),
    appCacheTags.playerStats(userId),
    appCacheTags.users(),
  ]);
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
        const result = await deps.importServerEventsFromLinks({
          serverId,
          linksInput: String((rawBody as { links?: unknown } | null | undefined)?.links ?? ""),
        });

        const importedEventIds = result.linkReports
          .map((report) => report.eventId)
          .filter((eventId): eventId is string => Boolean(eventId));

        deps.revalidateCacheEntries([
          deps.appCacheTags.serverContext(serverId),
          deps.appCacheTags.events(serverId),
          deps.appCacheTags.matches(serverId),
          ...importedEventIds.flatMap((eventId) => [
            deps.appCacheTags.event(eventId),
            deps.appCacheTags.match(eventId),
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
          deps.appCacheTags.rosters(serverId),
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
