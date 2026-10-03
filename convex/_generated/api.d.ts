/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiKeyValidators from "../apiKeyValidators.js";
import type * as articles from "../articles.js";
import type * as calendarFeed from "../calendarFeed.js";
import type * as competitions from "../competitions.js";
import type * as crons from "../crons.js";
import type * as dashboardActor from "../dashboardActor.js";
import type * as dashboardSessionStore from "../dashboardSessionStore.js";
import type * as dashboardSessions from "../dashboardSessions.js";
import type * as discordConfig from "../discordConfig.js";
import type * as discordMemberAccessStore from "../discordMemberAccessStore.js";
import type * as discordMembership from "../discordMembership.js";
import type * as discordPublicPanels from "../discordPublicPanels.js";
import type * as discordPublicationTable from "../discordPublicationTable.js";
import type * as discordPublications from "../discordPublications.js";
import type * as discordRosters from "../discordRosters.js";
import type * as discordSync from "../discordSync.js";
import type * as discord_shared from "../discord_shared.js";
import type * as eventResultStore from "../eventResultStore.js";
import type * as eventResults from "../eventResults.js";
import type * as events from "../events.js";
import type * as gameData from "../gameData.js";
import type * as gameDataCollector from "../gameDataCollector.js";
import type * as gameDataHistory from "../gameDataHistory.js";
import type * as gameDataValidators from "../gameDataValidators.js";
import type * as gameHistoryReads from "../gameHistoryReads.js";
import type * as gameHistoryStore from "../gameHistoryStore.js";
import type * as groups from "../groups.js";
import type * as guildGames from "../guildGames.js";
import type * as guilds from "../guilds.js";
import type * as identity from "../identity.js";
import type * as integrationChangeLog from "../integrationChangeLog.js";
import type * as integrationChanges from "../integrationChanges.js";
import type * as integrationMutation from "../integrationMutation.js";
import type * as leagueDiscovery from "../leagueDiscovery.js";
import type * as leagueDiscoveryJobs from "../leagueDiscoveryJobs.js";
import type * as leagueDiscoveryQueue from "../leagueDiscoveryQueue.js";
import type * as leagueDiscoveryTable from "../leagueDiscoveryTable.js";
import type * as leagueFixtureReads from "../leagueFixtureReads.js";
import type * as leagueMatchData from "../leagueMatchData.js";
import type * as leagueMatches from "../leagueMatches.js";
import type * as leagueTrackingStore from "../leagueTrackingStore.js";
import type * as managedRolePolicy from "../managedRolePolicy.js";
import type * as matchRecaps from "../matchRecaps.js";
import type * as matchStats from "../matchStats.js";
import type * as meetingAttendance from "../meetingAttendance.js";
import type * as memberObservations from "../memberObservations.js";
import type * as memberRoleOperations from "../memberRoleOperations.js";
import type * as membershipSubject from "../membershipSubject.js";
import type * as membership_shared from "../membership_shared.js";
import type * as migrations from "../migrations.js";
import type * as peopleChanges from "../peopleChanges.js";
import type * as peopleProjection from "../peopleProjection.js";
import type * as peopleSummaries from "../peopleSummaries.js";
import type * as performanceHistory from "../performanceHistory.js";
import type * as platformIdLinks from "../platformIdLinks.js";
import type * as platformIdentityLinks from "../platformIdentityLinks.js";
import type * as platformIdentityStore from "../platformIdentityStore.js";
import type * as platformSettings from "../platformSettings.js";
import type * as playerStats from "../playerStats.js";
import type * as players from "../players.js";
import type * as privacy from "../privacy.js";
import type * as publicApi from "../publicApi.js";
import type * as publicPreviews from "../publicPreviews.js";
import type * as publicProfiles from "../publicProfiles.js";
import type * as publicStats from "../publicStats.js";
import type * as resultValidators from "../resultValidators.js";
import type * as rosterSync from "../rosterSync.js";
import type * as rosterWriterAccess from "../rosterWriterAccess.js";
import type * as rosters from "../rosters.js";
import type * as scheduledJobs from "../scheduledJobs.js";
import type * as serverContext from "../serverContext.js";
import type * as serverDashboard from "../serverDashboard.js";
import type * as serverMetadata from "../serverMetadata.js";
import type * as serverRosters from "../serverRosters.js";
import type * as serverSetup from "../serverSetup.js";
import type * as signupActivity from "../signupActivity.js";
import type * as squadPresets from "../squadPresets.js";
import type * as sso from "../sso.js";
import type * as ssoTokenStore from "../ssoTokenStore.js";
import type * as stratmaps from "../stratmaps.js";
import type * as topicPresets from "../topicPresets.js";
import type * as uploads from "../uploads.js";
import type * as userAssignments from "../userAssignments.js";
import type * as users from "../users.js";
import type * as warconData from "../warconData.js";
import type * as warconReads from "../warconReads.js";
import type * as webhookDispatcher from "../webhookDispatcher.js";
import type * as webhookQueue from "../webhookQueue.js";
import type * as webhooks from "../webhooks.js";
import type * as websiteEventCommands from "../websiteEventCommands.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiKeyValidators: typeof apiKeyValidators;
  articles: typeof articles;
  calendarFeed: typeof calendarFeed;
  competitions: typeof competitions;
  crons: typeof crons;
  dashboardActor: typeof dashboardActor;
  dashboardSessionStore: typeof dashboardSessionStore;
  dashboardSessions: typeof dashboardSessions;
  discordConfig: typeof discordConfig;
  discordMemberAccessStore: typeof discordMemberAccessStore;
  discordMembership: typeof discordMembership;
  discordPublicPanels: typeof discordPublicPanels;
  discordPublicationTable: typeof discordPublicationTable;
  discordPublications: typeof discordPublications;
  discordRosters: typeof discordRosters;
  discordSync: typeof discordSync;
  discord_shared: typeof discord_shared;
  eventResultStore: typeof eventResultStore;
  eventResults: typeof eventResults;
  events: typeof events;
  gameData: typeof gameData;
  gameDataCollector: typeof gameDataCollector;
  gameDataHistory: typeof gameDataHistory;
  gameDataValidators: typeof gameDataValidators;
  gameHistoryReads: typeof gameHistoryReads;
  gameHistoryStore: typeof gameHistoryStore;
  groups: typeof groups;
  guildGames: typeof guildGames;
  guilds: typeof guilds;
  identity: typeof identity;
  integrationChangeLog: typeof integrationChangeLog;
  integrationChanges: typeof integrationChanges;
  integrationMutation: typeof integrationMutation;
  leagueDiscovery: typeof leagueDiscovery;
  leagueDiscoveryJobs: typeof leagueDiscoveryJobs;
  leagueDiscoveryQueue: typeof leagueDiscoveryQueue;
  leagueDiscoveryTable: typeof leagueDiscoveryTable;
  leagueFixtureReads: typeof leagueFixtureReads;
  leagueMatchData: typeof leagueMatchData;
  leagueMatches: typeof leagueMatches;
  leagueTrackingStore: typeof leagueTrackingStore;
  managedRolePolicy: typeof managedRolePolicy;
  matchRecaps: typeof matchRecaps;
  matchStats: typeof matchStats;
  meetingAttendance: typeof meetingAttendance;
  memberObservations: typeof memberObservations;
  memberRoleOperations: typeof memberRoleOperations;
  membershipSubject: typeof membershipSubject;
  membership_shared: typeof membership_shared;
  migrations: typeof migrations;
  peopleChanges: typeof peopleChanges;
  peopleProjection: typeof peopleProjection;
  peopleSummaries: typeof peopleSummaries;
  performanceHistory: typeof performanceHistory;
  platformIdLinks: typeof platformIdLinks;
  platformIdentityLinks: typeof platformIdentityLinks;
  platformIdentityStore: typeof platformIdentityStore;
  platformSettings: typeof platformSettings;
  playerStats: typeof playerStats;
  players: typeof players;
  privacy: typeof privacy;
  publicApi: typeof publicApi;
  publicPreviews: typeof publicPreviews;
  publicProfiles: typeof publicProfiles;
  publicStats: typeof publicStats;
  resultValidators: typeof resultValidators;
  rosterSync: typeof rosterSync;
  rosterWriterAccess: typeof rosterWriterAccess;
  rosters: typeof rosters;
  scheduledJobs: typeof scheduledJobs;
  serverContext: typeof serverContext;
  serverDashboard: typeof serverDashboard;
  serverMetadata: typeof serverMetadata;
  serverRosters: typeof serverRosters;
  serverSetup: typeof serverSetup;
  signupActivity: typeof signupActivity;
  squadPresets: typeof squadPresets;
  sso: typeof sso;
  ssoTokenStore: typeof ssoTokenStore;
  stratmaps: typeof stratmaps;
  topicPresets: typeof topicPresets;
  uploads: typeof uploads;
  userAssignments: typeof userAssignments;
  users: typeof users;
  warconData: typeof warconData;
  warconReads: typeof warconReads;
  webhookDispatcher: typeof webhookDispatcher;
  webhookQueue: typeof webhookQueue;
  webhooks: typeof webhooks;
  websiteEventCommands: typeof websiteEventCommands;
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
