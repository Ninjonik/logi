import type { Client } from "discord.js";

import {
  buildEventSignatureMap,
  buildGuildPayload as buildGuildPayloadShared,
  getChangedEventIds,
} from "../../../src/application/discord-sync/payload-builder";
import { convex, references } from "../convex";
import { env } from "../environment";
import { logError, logInfo, logWarn } from "../log";
import { syncGuildPayload } from "../sync";
import { syncCalendarPanel } from "../sync/panels";
import { getCalendarSyncVersion } from "../sync/work";
import type { EventSyncContext, EventSyncIndex, SyncPayload } from "../types";

import { GuildCache, hasConfiguredClanDiscordTarget, type GuildRuntimeData } from "./guild-cache";

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
        const runtime = this.guildCache.get(guildId);
        if (runtime && hasConfiguredClanDiscordTarget(runtime)) {
          this.queueGuildSync(guildId);
        }
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

  getGuildConfig(guildId: string) {
    return this.guildCache.get(guildId)?.config;
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
      // The active flush drains the live queues in its loop. Scheduling another
      // timer here only creates an endless 500ms warning loop while a Discord
      // request is slow; it cannot make the queued work run sooner.
      logInfo("sync-service", "Flush request coalesced into active flush");
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
            const runtime = this.guildCache.get(guildId);
            if (runtime && hasConfiguredClanDiscordTarget(runtime)) {
              this.queuedGuildIds.add(guildId);
            }
          }
          logInfo("sync-service", "Expanded full resync into guild queue", {
            queuedGuilds: this.queuedGuildIds.size,
          });
        }

        // Take ownership of this cycle's work before awaiting any Discord calls.
        // Work enqueued while the cycle is running remains in the live set for the
        // next loop instead of being erased after the older snapshot completes.
        const queuedEventIdsForCycle = new Set(this.queuedEventIds);
        this.queuedEventIds.clear();
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
            await this.syncGuild(guildId, queuedEventIdsForCycle);
          } catch (error) {
            logError("sync-service", "Discord bot guild sync failed", {
              guildId,
              error,
            });
          }
        }

        const eventIds = [...queuedEventIdsForCycle];
        if (eventIds.length > 0) {
          logInfo("sync-service", "Processing queued events", {
            eventIds,
            count: eventIds.length,
          });
        }
        for (const eventId of eventIds) {
          try {
            await this.syncEvent(eventId, queuedEventIdsForCycle);
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
    const { rosterIndexByEventId: nextRosterIndexByEventId, signatures: nextEventSignatureById } = buildEventSignatureMap(index);
    const queuedDueToIndexChanges = getChangedEventIds(nextEventSignatureById, this.eventSignatureById, initialLoad);
    for (const eventId of queuedDueToIndexChanges) {
      this.queuedEventIds.add(eventId);
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

  private async syncGuild(guildId: string, queuedEventIds: Set<string>) {
    const runtime = this.guildCache.get(guildId);
    if (!runtime?.config) {
      logWarn("sync-service", "Skipping guild sync because config is missing", { guildId });
      return;
    }
    if (!hasConfiguredClanDiscordTarget(runtime)) {
      logInfo("sync-service", "Skipping guild sync because clan Discord settings are empty", { guildId });
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
    await syncGuildPayload(this.client, queuedEventIds, payload, "full");
  }

  private async syncEvent(eventId: string, queuedEventIds: Set<string>) {
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
    if (!hasConfiguredClanDiscordTarget(runtime)) {
      logInfo("sync-service", "Skipping event sync because clan Discord settings are empty", {
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
    await syncGuildPayload(this.client, queuedEventIds, payload, "events_only");
    if (context.syncState?.lastCalendarSyncVersion !== getCalendarSyncVersion(context.event)) {
      await this.syncGuildCalendar(context.event.guildId);
    }
  }

  private async loadEventSyncContext(eventId: string) {
    return (await convex.query(references.getEventSyncContext, {
      secret: env.internalSecret,
      eventId: eventId as never,
    })) as EventSyncContext | null;
  }

  private async syncGuildCalendar(guildId: string) {
    const runtime = this.guildCache.get(guildId);
    if (!runtime?.config || !hasConfiguredClanDiscordTarget(runtime)) {
      return;
    }

    const eventIds = [...this.eventIndexById.values()]
      .filter((event) => event.guildId === guildId)
      .map((event) => event.id);
    const contexts = await Promise.all(eventIds.map((eventId) => this.loadEventSyncContext(eventId)));
    const payload = buildGuildPayload(runtime, contexts);
    await syncCalendarPanel(this.client, payload);
  }
}

function buildGuildPayload(runtime: GuildRuntimeData, contexts: Array<EventSyncContext | null>): SyncPayload {
  return buildGuildPayloadShared(
    runtime as GuildRuntimeData & { config: NonNullable<GuildRuntimeData["config"]> },
    contexts,
  ) as SyncPayload;
}
