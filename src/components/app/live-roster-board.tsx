"use client";

import { makeFunctionReference } from "convex/server";
import { useQuery } from "convex/react";

import type { Dictionary } from "@/i18n/dictionaries";
import type { DiscordConfig, EventRecord, Group, Roster, AppUser } from "@/types/domain";
import type { ServerUserAssignment } from "@/lib/server-user-management";

import { RosterBoard } from "./roster-board";

type LiveRosterBoardProps = {
  rosterId: string;
  serverId: string;
  locale: string;
  userId: string;
  dictionary: Dictionary;
  initialRoster?: Roster;
  initialEvent?: EventRecord;
  initialUsers: AppUser[];
  initialAssignments: ServerUserAssignment[];
  initialGroups: Group[];
  initialCanAdmin: boolean;
  initialDiscordConfig: DiscordConfig | null;
};

type LiveRosterDetail = {
  canAdmin: boolean;
  event: EventRecord;
  roster: Roster;
  users: AppUser[];
  groups: Group[];
  assignments: ServerUserAssignment[];
  discordConfig: DiscordConfig | null;
};

const getRosterDetailReference = makeFunctionReference<"query">("serverRosters:getRosterDetail");

export function LiveRosterBoard(props: LiveRosterBoardProps) {
  const liveData = useQuery(getRosterDetailReference, {
    userId: props.userId,
    serverId: props.serverId as never,
    rosterId: props.rosterId as never,
  }) as LiveRosterDetail | null | undefined;

  const roster = liveData?.roster ?? props.initialRoster;
  const event = liveData?.event ?? props.initialEvent;
  const users = liveData?.users ?? props.initialUsers;
  const userAssignments = liveData?.assignments ?? props.initialAssignments;
  const groups = liveData?.groups ?? props.initialGroups;
  const canAdmin = liveData?.canAdmin ?? props.initialCanAdmin;
  const discordConfig = liveData?.discordConfig ?? props.initialDiscordConfig;

  return (
    <RosterBoard
      roster={roster}
      event={event}
      users={users}
      userAssignments={userAssignments}
      groups={groups}
      canAdmin={canAdmin}
      dictionary={props.dictionary}
      serverId={props.serverId}
      locale={props.locale}
      timezone={discordConfig?.timezone}
      meetingChannelId={discordConfig?.meetingChannelId}
      defaultMode="view"
    />
  );
}
