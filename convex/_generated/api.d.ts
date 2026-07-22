/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as discordConfig from "../discordConfig.js";
import type * as discordMembership from "../discordMembership.js";
import type * as discordRosters from "../discordRosters.js";
import type * as discordSync from "../discordSync.js";
import type * as discord_shared from "../discord_shared.js";
import type * as events from "../events.js";
import type * as groups from "../groups.js";
import type * as guilds from "../guilds.js";
import type * as identity from "../identity.js";
import type * as matchStats from "../matchStats.js";
import type * as migrations from "../migrations.js";
import type * as platformIdLinks from "../platformIdLinks.js";
import type * as playerStats from "../playerStats.js";
import type * as players from "../players.js";
import type * as rosterSync from "../rosterSync.js";
import type * as rosters from "../rosters.js";
import type * as serverContext from "../serverContext.js";
import type * as serverMetadata from "../serverMetadata.js";
import type * as serverRosters from "../serverRosters.js";
import type * as serverSetup from "../serverSetup.js";
import type * as squadPresets from "../squadPresets.js";
import type * as topicPresets from "../topicPresets.js";
import type * as uploads from "../uploads.js";
import type * as userAssignments from "../userAssignments.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  discordConfig: typeof discordConfig;
  discordMembership: typeof discordMembership;
  discordRosters: typeof discordRosters;
  discordSync: typeof discordSync;
  discord_shared: typeof discord_shared;
  events: typeof events;
  groups: typeof groups;
  guilds: typeof guilds;
  identity: typeof identity;
  matchStats: typeof matchStats;
  migrations: typeof migrations;
  platformIdLinks: typeof platformIdLinks;
  playerStats: typeof playerStats;
  players: typeof players;
  rosterSync: typeof rosterSync;
  rosters: typeof rosters;
  serverContext: typeof serverContext;
  serverMetadata: typeof serverMetadata;
  serverRosters: typeof serverRosters;
  serverSetup: typeof serverSetup;
  squadPresets: typeof squadPresets;
  topicPresets: typeof topicPresets;
  uploads: typeof uploads;
  userAssignments: typeof userAssignments;
  users: typeof users;
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
