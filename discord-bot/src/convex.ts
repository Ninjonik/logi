import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import { env } from "./environment";

export const convex = new ConvexHttpClient(env.convexUrl);

export const references = {
  acknowledgeAttendance: makeFunctionReference<"mutation">("rosters:acknowledgeAttendance"),
  appendAttendanceReminderLog: makeFunctionReference<"mutation">("events:appendAttendanceReminderLog"),
  closeTicketThread: makeFunctionReference<"mutation">("discord:closeTicketThread"),
  closeMembershipApplicationThread: makeFunctionReference<"mutation">("discord:closeMembershipApplicationThread"),
  consumePlatformIdLinkToken: makeFunctionReference<"mutation">("discord:consumePlatformIdLinkToken"),
  createMembershipApplicationThread: makeFunctionReference<"mutation">("discord:createMembershipApplicationThread"),
  createPlatformIdLinkToken: makeFunctionReference<"mutation">("discord:createPlatformIdLinkToken"),
  createTicketThread: makeFunctionReference<"mutation">("discord:createTicketThread"),
  getEventInteractionContext: makeFunctionReference<"query">("discord:getEventInteractionContext"),
  getEventSignupContext: makeFunctionReference<"query">("discord:getEventSignupContext"),
  getMembershipApplicationPrereq: makeFunctionReference<"query">("discord:getMembershipApplicationPrereq"),
  getMembershipApplicationThreadContext: makeFunctionReference<"query">("discord:getMembershipApplicationThreadContext"),
  getMembershipCategoryContext: makeFunctionReference<"query">("discord:getMembershipCategoryContext"),
  getTicketCategoryContext: makeFunctionReference<"query">("discord:getTicketCategoryContext"),
  getTicketThreadContext: makeFunctionReference<"query">("discord:getTicketThreadContext"),
  listSyncPayloads: makeFunctionReference<"query">("discord:listSyncPayloads"),
  reconcileStatuses: makeFunctionReference<"mutation">("events:reconcileStatuses"),
  syncMemberAccess: makeFunctionReference<"mutation">("discord:syncMemberAccess"),
  toggleSignUp: makeFunctionReference<"mutation">("events:toggleSignUp"),
  updateMembershipApplicationTranscriptMessage: makeFunctionReference<"mutation">("discord:updateMembershipApplicationTranscriptMessage"),
  updateMembershipPanelState: makeFunctionReference<"mutation">("discord:updateMembershipPanelState"),
  updateEventSyncState: makeFunctionReference<"mutation">("discord:updateEventSyncState"),
  updateTicketTranscriptMessage: makeFunctionReference<"mutation">("discord:updateTicketTranscriptMessage"),
  updateTicketPanelState: makeFunctionReference<"mutation">("discord:updateTicketPanelState"),
  upsertAssignment: makeFunctionReference<"mutation">("userAssignments:upsertByServerDiscordId"),
  removeAssignment: makeFunctionReference<"mutation">("userAssignments:remove"),
  getAssignmentForServerUser: makeFunctionReference<"query">("userAssignments:getForServerUser"),
};
