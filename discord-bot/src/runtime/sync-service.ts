import type { Client } from "discord.js";

import { convex, references } from "../convex";
import { env } from "../environment";
import { logError, logInfo, logWarn } from "../log";
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
  private flushDueAt?: number;
  private isFlushing = false;
  private fullResyncRequested = false;

  constructor(private readonly client: Client) {}

  async start() {
    logInfo("sync-service", "Starting sync service");
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
    logInfo("sync-service", "Loaded initial event index", {
      eventCount: initialIndex.events.length,
      rosterCount: initialIndex.rosters.length,
    });

    const watch = convex.watchQuery(references.listEventSyncIndex, {
      secret: env.internalSecret,
    });
    this.eventIndexUnsubscribe = watch.onUpdate(() => {
      try {
        const index = watch.localQueryResult() as EventSyncIndex | undefined;
        if (!index) {
          return;
        }

        this.applyEventIndex(index, false);
        logInfo("sync-service", "Convex event index updated", {
          eventCount: index.events.length,
          rosterCount: index.rosters.length,
        });
        this.scheduleFlush(250);
      } catch (error) {
        logError("sync-service", "Failed to process event sync index update", { error });
      }
    });

    this.requestFullResync();
  }

  stop() {
    this.eventIndexUnsubscribe?.();
    this.guildCache.stop();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
      this.flushDueAt = undefined;
    }
  }

  queueEventSync(eventId: string) {
    this.queuedEventIds.add(eventId);
    logInfo("sync-service", "Queued event sync", {
      eventId,
      queuedEvents: this.queuedEventIds.size,
    });
  }

  queueGuildSync(guildId: string) {
    this.queuedGuildIds.add(guildId);
    logInfo("sync-service", "Queued guild sync", {
      guildId,
      queuedGuilds: this.queuedGuildIds.size,
    });
  }

  triggerSoon(delayMs = 2000) {
    logInfo("sync-service", "Triggering scheduled flush", {
      delayMs,
      queuedGuilds: this.queuedGuildIds.size,
      queuedEvents: this.queuedEventIds.size,
    });
    this.scheduleFlush(delayMs);
  }

  requestFullResync() {
    this.fullResyncRequested = true;
    logInfo("sync-service", "Full resync requested");
    this.scheduleFlush(250);
  }

  private scheduleFlush(delayMs: number) {
    if (this.flushTimer) {
      const nextDueAt = Date.now() + delayMs;
      if (this.flushDueAt && this.flushDueAt <= nextDueAt) {
        logInfo("sync-service", "Flush already scheduled", { delayMs });
        return;
      }

      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
      this.flushDueAt = undefined;
      logInfo("sync-service", "Flush already scheduled", { delayMs });
    }

    logInfo("sync-service", "Scheduling flush", {
      delayMs,
      queuedGuilds: this.queuedGuildIds.size,
      queuedEvents: this.queuedEventIds.size,
      fullResyncRequested: this.fullResyncRequested,
    });
    this.flushDueAt = Date.now() + delayMs;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.flushDueAt = undefined;
      void this.flush().catch((error) => {
        logError("sync-service", "Flush crashed unexpectedly", { error });
      });
    }, delayMs);
  }

  private async flush() {
    if (this.isFlushing) {
      logWarn("sync-service", "Flush requested while another flush is running");
      this.scheduleFlush(500);
      return;
    }

    this.isFlushing = true;
    logInfo("sync-service", "Flush started", {
      queuedGuilds: this.queuedGuildIds.size,
      queuedEvents: this.queuedEventIds.size,
      fullResyncRequested: this.fullResyncRequested,
    });

    try {
      while (this.fullResyncRequested || this.queuedGuildIds.size > 0 || this.queuedEventIds.size > 0) {
        if (this.fullResyncRequested) {
          this.fullResyncRequested = false;
          for (const guildId of this.guildCache.getAllGuildIds()) {
            this.queuedGuildIds.add(guildId);
          }
          logInfo("sync-service", "Expanded full resync into guild queue", {
            queuedGuilds: this.queuedGuildIds.size,
          });
        }

        const guildIds = [...this.queuedGuildIds];
        this.queuedGuildIds.clear();
        if (guildIds.length > 0) {
          logInfo("sync-service", "Processing queued guilds", {
            guildIds,
            count: guildIds.length,
          });
        }
        for (const guildId of guildIds) {
          try {
            await this.syncGuild(guildId);
          } catch (error) {
            logError("sync-service", "Discord bot guild sync failed", {
              guildId,
              error,
            });
          }
        }

        const eventIds = [...this.queuedEventIds];
        this.queuedEventIds.clear();
        if (eventIds.length > 0) {
          logInfo("sync-service", "Processing queued events", {
            eventIds,
            count: eventIds.length,
          });
        }
        for (const eventId of eventIds) {
          try {
            await this.syncEvent(eventId);
          } catch (error) {
            logError("sync-service", "Discord bot queued event sync failed", {
              eventId,
              error,
            });
          }
        }
      }
      logInfo("sync-service", "Flush finished with no remaining work");
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

    const queuedDueToIndexChanges: string[] = [];
    for (const [eventId, signature] of nextEventSignatureById) {
      if (initialLoad || this.eventSignatureById.get(eventId) !== signature) {
        this.queuedEventIds.add(eventId);
        queuedDueToIndexChanges.push(eventId);
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

    if (queuedDueToIndexChanges.length > 0) {
      logInfo(
        "sync-service",
        initialLoad ? "Queued events from initial index load" : "Queued events from Convex index changes",
        {
          eventIds: queuedDueToIndexChanges,
          count: queuedDueToIndexChanges.length,
        },
      );
    }
  }

  private async syncGuild(guildId: string) {
    const runtime = this.guildCache.get(guildId);
    if (!runtime?.config) {
      logWarn("sync-service", "Skipping guild sync because config is missing", { guildId });
      return;
    }

    const eventIds = [...this.eventIndexById.values()]
      .filter((event) => event.guildId === guildId)
      .map((event) => event.id);
    const contexts = await Promise.all(eventIds.map((eventId) => this.loadEventSyncContext(eventId)));
    const payload = buildGuildPayload(runtime, contexts);
    logInfo("sync-service", "Syncing guild payload", {
      guildId,
      eventCount: payload.events.length,
      rosterCount: payload.rosters.length,
      syncStateCount: payload.syncStates.length,
    });
    await syncGuildPayload(this.client, this.queuedEventIds, payload);
  }

  private async syncEvent(eventId: string) {
    const context = await this.loadEventSyncContext(eventId);
    if (!context) {
      logWarn("sync-service", "Skipping event sync because context was not found", { eventId });
      return;
    }

    const runtime = this.guildCache.get(context.event.guildId);
    if (!runtime?.config) {
      logWarn("sync-service", "Skipping event sync because guild config is missing", {
        eventId,
        guildId: context.event.guildId,
      });
      return;
    }

    const payload = buildGuildPayload(runtime, [context]);
    logInfo("sync-service", "Syncing single event payload", {
      eventId,
      guildId: context.event.guildId,
      rosterCount: payload.rosters.length,
      hasSyncState: payload.syncStates.length > 0,
    });
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
