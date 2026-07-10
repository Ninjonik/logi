/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as discord from "../discord.js";
import type * as events from "../events.js";
import type * as groups from "../groups.js";
import type * as guilds from "../guilds.js";
import type * as players from "../players.js";
import type * as rosters from "../rosters.js";
import type * as serverData from "../serverData.js";
import type * as serverSetup from "../serverSetup.js";
import type * as topicPresets from "../topicPresets.js";
import type * as uploads from "../uploads.js";
import type * as userAssignments from "../userAssignments.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  discord: typeof discord;
  events: typeof events;
  groups: typeof groups;
  guilds: typeof guilds;
  players: typeof players;
  rosters: typeof rosters;
  serverData: typeof serverData;
  serverSetup: typeof serverSetup;
  topicPresets: typeof topicPresets;
  uploads: typeof uploads;
  userAssignments: typeof userAssignments;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
