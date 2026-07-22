import { ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import WebSocket from "ws";

import { env } from "./environment";

// Node 20 on the production host does not expose a global WebSocket.
// Convex's reactive client expects one for query watchers used by the bot.
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = WebSocket as typeof globalThis.WebSocket;
}

export const convex = new ConvexReactClient(env.convexUrl);

export const references = {
  acknowledgeAttendance: makeFunctionReference<"mutation">("rosters:acknowledgeAttendance"),
  appendAttendanceReminderLog: makeFunctionReference<"mutation">("events:appendAttendanceReminderLog"),
  closeTicketThread: makeFunctionReference<"mutation">("discordMembership:closeTicketThread"),
  closeMembershipApplicationThread: makeFunctionReference<"mutation">("discordMembership:closeMembershipApplicationThread"),
  consumePlatformIdLinkToken: makeFunctionReference<"mutation">("platformIdLinks:consumePlatformIdLinkToken"),
  createMembershipApplicationThread: makeFunctionReference<"mutation">("discordMembership:createMembershipApplicationThread"),
  createPlatformIdLinkToken: makeFunctionReference<"mutation">("platformIdLinks:createPlatformIdLinkToken"),
  createTicketThread: makeFunctionReference<"mutation">("discordMembership:createTicketThread"),
  getEventInteractionContext: makeFunctionReference<"query">("discordSync:getEventInteractionContext"),
  getEventSignupContext: makeFunctionReference<"query">("discordSync:getEventSignupContext"),
  getEventSyncContext: makeFunctionReference<"query">("discordSync:getEventSyncContext"),
  findNoticeTarget: makeFunctionReference<"query">("events:findNoticeTarget"),
  getConfigByDiscordGuildId: makeFunctionReference<"query">("discordConfig:getConfigByDiscordGuildId"),
  getMembershipApplicationPrereq: makeFunctionReference<"query">("discordMembership:getMembershipApplicationPrereq"),
  getMembershipApplicationThreadContext: makeFunctionReference<"query">("discordMembership:getMembershipApplicationThreadContext"),
  getMembershipCategoryContext: makeFunctionReference<"query">("discordMembership:getMembershipCategoryContext"),
  getTicketCategoryContext: makeFunctionReference<"query">("discordMembership:getTicketCategoryContext"),
  getTicketThreadContext: makeFunctionReference<"query">("discordMembership:getTicketThreadContext"),
  listEventSyncIndex: makeFunctionReference<"query">("discordSync:listEventSyncIndex"),
  listGuildCacheSnapshot: makeFunctionReference<"query">("discordSync:listGuildCacheSnapshot"),
  listSyncPayloads: makeFunctionReference<"query">("discordSync:listSyncPayloads"),
  reconcileStatuses: makeFunctionReference<"mutation">("events:reconcileStatuses"),
  syncMemberAccess: makeFunctionReference<"mutation">("discordSync:syncMemberAccess"),
  toggleSignUp: makeFunctionReference<"mutation">("events:toggleSignUp"),
  upsertNotice: makeFunctionReference<"mutation">("events:upsertNotice"),
  updateMembershipApplicationTranscriptMessage: makeFunctionReference<"mutation">("discordMembership:updateMembershipApplicationTranscriptMessage"),
  updateMembershipPanelState: makeFunctionReference<"mutation">("discordConfig:updateMembershipPanelState"),
  updateEventSyncState: makeFunctionReference<"mutation">("discordSync:updateEventSyncState"),
  updateTicketTranscriptMessage: makeFunctionReference<"mutation">("discordMembership:updateTicketTranscriptMessage"),
  updateTicketPanelState: makeFunctionReference<"mutation">("discordConfig:updateTicketPanelState"),
  upsertAssignment: makeFunctionReference<"mutation">("userAssignments:upsertByServerDiscordId"),
  removeAssignment: makeFunctionReference<"mutation">("userAssignments:remove"),
  getAssignmentForServerUser: makeFunctionReference<"query">("userAssignments:getForServerUser"),
};
