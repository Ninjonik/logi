import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";
import type { DiscordConfig, MembershipSettings, TicketSettings } from "@/types/domain";

const getConfigByGuildReference = makeFunctionReference<"query">("discordConfig:getConfigByGuild");
const getMembershipApplicationByAssignmentReference = makeFunctionReference<"query">("discordMembership:getMembershipApplicationByAssignment");
const upsertConfigReference = makeFunctionReference<"mutation">("discordConfig:upsertConfig");

export async function getDiscordConfigByGuild(guildId: string) {
  return (await fetchQuery(getConfigByGuildReference, { guildId: guildId as never })) as DiscordConfig | null;
}

export async function getMembershipApplicationByAssignment(assignmentId: string) {
  return (await fetchQuery(getMembershipApplicationByAssignmentReference, {
    secret: getInternalAuthSecret(),
    assignmentId: assignmentId as never,
  })) as { categoryId: string } | null;
}

export async function saveDiscordConfig(input: {
  guildId: string;
  timezone: string;
  defaultLanguage: "en" | "cs";
  announcementsChannelId?: string;
  forumCategoryId?: string;
  meetingChannelId?: string;
  clanRoleId?: string;
  dashboardAdminRoleId?: string;
  ticketSettings?: TicketSettings;
  membershipSettings?: MembershipSettings;
}) {
  return await fetchMutation(upsertConfigReference, {
    secret: getInternalAuthSecret(),
    guildId: input.guildId as never,
    timezone: input.timezone,
    defaultLanguage: input.defaultLanguage,
    announcementsChannelId: input.announcementsChannelId,
    forumCategoryId: input.forumCategoryId,
    meetingChannelId: input.meetingChannelId,
    clanRoleId: input.clanRoleId,
    dashboardAdminRoleId: input.dashboardAdminRoleId,
    ticketSettings: input.ticketSettings,
    membershipSettings: input.membershipSettings,
  });
}

const confirmRosterAttendanceFromMeetingChannelReference = makeFunctionReference<"mutation">("discordRosters:confirmRosterAttendanceFromMeetingChannel");

export async function confirmRosterAttendanceFromMeetingChannel(input: {
  guildId: string;
  rosterId: string;
}) {
  return await fetchMutation(confirmRosterAttendanceFromMeetingChannelReference, {
    secret: getInternalAuthSecret(),
    guildId: input.guildId,
    rosterId: input.rosterId as any,
  }) as {
    matchedVoiceCount: number;
    rosteredCount: number;
    updatedCount: number;
    updatedUserIds: string[];
  };
}
