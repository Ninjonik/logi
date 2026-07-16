import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import { env } from "./environment";

export const convex = new ConvexHttpClient(env.convexUrl);

export const references = {
  acknowledgeAttendance: makeFunctionReference<"mutation">("rosters:acknowledgeAttendance"),
  appendAttendanceReminderLog: makeFunctionReference<"mutation">("events:appendAttendanceReminderLog"),
  closeTicketThread: makeFunctionReference<"mutation">("discord:closeTicketThread"),
  createTicketThread: makeFunctionReference<"mutation">("discord:createTicketThread"),
  getEventInteractionContext: makeFunctionReference<"query">("discord:getEventInteractionContext"),
  getEventSignupContext: makeFunctionReference<"query">("discord:getEventSignupContext"),
  getTicketCategoryContext: makeFunctionReference<"query">("discord:getTicketCategoryContext"),
  getTicketThreadContext: makeFunctionReference<"query">("discord:getTicketThreadContext"),
  listSyncPayloads: makeFunctionReference<"query">("discord:listSyncPayloads"),
  reconcileStatuses: makeFunctionReference<"mutation">("events:reconcileStatuses"),
  syncMemberAccess: makeFunctionReference<"mutation">("discord:syncMemberAccess"),
  toggleSignUp: makeFunctionReference<"mutation">("events:toggleSignUp"),
  updateEventSyncState: makeFunctionReference<"mutation">("discord:updateEventSyncState"),
  updateTicketTranscriptMessage: makeFunctionReference<"mutation">("discord:updateTicketTranscriptMessage"),
  updateTicketPanelState: makeFunctionReference<"mutation">("discord:updateTicketPanelState"),
};
