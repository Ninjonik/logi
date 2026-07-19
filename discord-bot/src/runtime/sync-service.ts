import type { Client } from "discord.js";

import { convex, references } from "../convex";
import { env } from "../environment";
import { syncGuildPayload } from "../sync";
import type { EventSyncContext, EventSyncIndex, SyncPayload } from "../types";

import { GuildCache, type GuildRuntimeData } from "./guild-cache";

type EventIndexRecord = EventSyncIndex["events"][number];
type RosterIndexRecord = EventSyncIndex["rosters"][number];

export class DiscordSyncService {
  private readonly queuedEventIds = new Set<string>();
  private readonly queuedGuildIds = new Set<string>();
  private readonly guildCache = new GuildCache();
  private readonly eventIndexById = new Map<string, EventIndexRecord>();
  private readonly rosterIndexByEventId = new Map<string, RosterIndexRecord>();
  private readonly eventSignatureById = new Map<string, string>();

  private eventIndexUnsubscribe?: () => void;
  private flushTimer?: ReturnType<typeof setTimeout>;
  private isFlushing = false;
  private fullResyncRequested = false;

  constructor(private readonly client: Client) {}

  async start() {
    await this.guildCache.start((guildIds) => {
      for (const guildId of guildIds) {
        this.queueGuildSync(guildId);
      }
      this.scheduleFlush(250);
    });

    const initialIndex = (await convex.query(references.listEventSyncIndex, {
      secret: env.internalSecret,
    })) as EventSyncIndex;
    this.applyEventIndex(initialIndex, true);

    const watch = convex.watchQuery(references.listEventSyncIndex, {
      secret: env.internalSecret,
    });
    this.eventIndexUnsubscribe = watch.onUpdate(() => {
      const index = watch.localQueryResult() as EventSyncIndex | undefined;
      if (!index) {
        return;
      }

      this.applyEventIndex(index, false);
      this.scheduleFlush(250);
    });

    this.requestFullResync();
  }

  stop() {
    this.eventIndexUnsubscribe?.();
    this.guildCache.stop();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  queueEventSync(eventId: string) {
    this.queuedEventIds.add(eventId);
  }

  queueGuildSync(guildId: string) {
    this.queuedGuildIds.add(guildId);
  }

  triggerSoon(delayMs = 2000) {
    this.scheduleFlush(delayMs);
  }

  requestFullResync() {
    this.fullResyncRequested = true;
    this.scheduleFlush(250);
  }

  private scheduleFlush(delayMs: number) {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      void this.flush();
    }, delayMs);
  }

  private async flush() {
    if (this.isFlushing) {
      this.scheduleFlush(500);
      return;
    }

    this.isFlushing = true;

    try {
      while (this.fullResyncRequested || this.queuedGuildIds.size > 0 || this.queuedEventIds.size > 0) {
        if (this.fullResyncRequested) {
          this.fullResyncRequested = false;
          for (const guildId of this.guildCache.getAllGuildIds()) {
            this.queuedGuildIds.add(guildId);
          }
        }

        const guildIds = [...this.queuedGuildIds];
        this.queuedGuildIds.clear();
        for (const guildId of guildIds) {
          await this.syncGuild(guildId);
        }

        const eventIds = [...this.queuedEventIds];
        this.queuedEventIds.clear();
        for (const eventId of eventIds) {
          await this.syncEvent(eventId);
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  private applyEventIndex(index: EventSyncIndex, initialLoad: boolean) {
    const nextEventIndexById = new Map(index.events.map((event) => [event.id, event]));
    const nextRosterIndexByEventId = new Map(index.rosters.map((roster) => [roster.eventId, roster]));
    const nextEventSignatureById = new Map<string, string>();

    for (const event of index.events) {
      const roster = nextRosterIndexByEventId.get(event.id);
      nextEventSignatureById.set(event.id, `${event.updatedAt}|${roster?.updatedAt ?? "no-roster"}`);
    }

    for (const [eventId, signature] of nextEventSignatureById) {
      if (initialLoad || this.eventSignatureById.get(eventId) !== signature) {
        this.queuedEventIds.add(eventId);
      }
    }

    this.eventIndexById.clear();
    this.rosterIndexByEventId.clear();
    this.eventSignatureById.clear();

    for (const [eventId, event] of nextEventIndexById) {
      this.eventIndexById.set(eventId, event);
    }
    for (const [eventId, roster] of nextRosterIndexByEventId) {
      this.rosterIndexByEventId.set(eventId, roster);
    }
    for (const [eventId, signature] of nextEventSignatureById) {
      this.eventSignatureById.set(eventId, signature);
    }
  }

  private async syncGuild(guildId: string) {
    const runtime = this.guildCache.get(guildId);
    if (!runtime?.config) {
      return;
    }

    const eventIds = [...this.eventIndexById.values()]
      .filter((event) => event.guildId === guildId)
      .map((event) => event.id);
    const contexts = await Promise.all(eventIds.map((eventId) => this.loadEventSyncContext(eventId)));
    const payload = buildGuildPayload(runtime, contexts);
    await syncGuildPayload(this.client, this.queuedEventIds, payload);
  }

  private async syncEvent(eventId: string) {
    const context = await this.loadEventSyncContext(eventId);
    if (!context) {
      return;
    }

    const runtime = this.guildCache.get(context.event.guildId);
    if (!runtime?.config) {
      return;
    }

    const payload = buildGuildPayload(runtime, [context]);
    await syncGuildPayload(this.client, this.queuedEventIds, payload);
  }

  private async loadEventSyncContext(eventId: string) {
    return (await convex.query(references.getEventSyncContext, {
      secret: env.internalSecret,
      eventId: eventId as never,
    })) as EventSyncContext | null;
  }
}

function buildGuildPayload(runtime: GuildRuntimeData, contexts: Array<EventSyncContext | null>): SyncPayload {
  const filteredContexts = contexts.filter((context): context is EventSyncContext => Boolean(context));

  return {
    config: runtime.config!,
    groups: runtime.groups,
    topicPresets: runtime.topicPresets,
    events: filteredContexts.map((context) => context.event),
    rosters: filteredContexts.flatMap((context) => (context.roster ? [context.roster] : [])),
    syncStates: filteredContexts.flatMap((context) => (context.syncState ? [context.syncState] : [])),
  };
}
