import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import { env } from "./environment";

export const convex = new ConvexHttpClient(env.convexUrl);

export const references = {
  acknowledgeAttendance: makeFunctionReference<"mutation">("rosters:acknowledgeAttendance"),
  appendAttendanceReminderLog: makeFunctionReference<"mutation">("events:appendAttendanceReminderLog"),
  getEventInteractionContext: makeFunctionReference<"query">("discord:getEventInteractionContext"),
  getEventSignupContext: makeFunctionReference<"query">("discord:getEventSignupContext"),
  listSyncPayloads: makeFunctionReference<"query">("discord:listSyncPayloads"),
  reconcileStatuses: makeFunctionReference<"mutation">("events:reconcileStatuses"),
  syncMemberAccess: makeFunctionReference<"mutation">("discord:syncMemberAccess"),
  toggleSignUp: makeFunctionReference<"mutation">("events:toggleSignUp"),
  updateEventSyncState: makeFunctionReference<"mutation">("discord:updateEventSyncState"),
};
