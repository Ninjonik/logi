import type { Client } from "discord.js";

import { logError, logInfo } from "./log";
import { processAttendanceReminders } from "./sync/attendance-reminders";
import { syncPayloadEvents } from "./sync/events";
import { syncGuildMemberAccess } from "./sync/member-access";
import { syncCalendarPanel, syncMembershipPanel, syncTicketPanel } from "./sync/panels";
import type { SyncPayload } from "./types";

export async function syncGuildPayload(
  client: Client,
  queuedEventIds: Set<string>,
  payload: SyncPayload,
  mode: "full" | "events_only" = "full",
) {
  logInfo("guild-sync", "Syncing guild payload", {
    guildId: payload.config.guildId,
    eventCount: payload.events.length,
    rosterCount: payload.rosters.length,
    syncStateCount: payload.syncStates.length,
    mode,
  });

  if (mode === "full") {
    await runGuildSyncStep("member access sync", payload, () => syncGuildMemberAccess(client, payload));
    await runGuildSyncStep("ticket panel sync", payload, () => syncTicketPanel(client, payload));
    await runGuildSyncStep("membership panel sync", payload, () => syncMembershipPanel(client, payload));
    await runGuildSyncStep("calendar panel sync", payload, () => syncCalendarPanel(client, payload));
    await runGuildSyncStep("attendance reminder sync", payload, () =>
      processAttendanceReminders(client, queuedEventIds, payload),
    );
  }

  await syncPayloadEvents(client, queuedEventIds, payload);
}

async function runGuildSyncStep(step: string, payload: SyncPayload, execute: () => Promise<void>) {
  try {
    await execute();
  } catch (error) {
    logError("guild-sync", `Discord bot ${step} failed`, {
      guildId: payload.config.guildId,
      error,
    });
  }
}
