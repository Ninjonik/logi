"use client";

import { useState, useMemo } from "react";
import { RosterBoard } from "@/components/app/roster-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/i18n/dictionaries";
import { getUserScoreForGuild } from "@/lib/user-scores";
import type { ServerUserAssignment } from "@/lib/server-user-management";
import type { AppUser, EventRecord, Group, Roster, SquadPreset } from "@/types/domain";
import { formatDateTime } from "@/lib/format";

const SIGNUP_NOT_ATTENDING = "NOT_ATTENDING";

export function RosterCreator({
  events,
  rosters,
  squadPresets,
  users,
  userAssignments,
  groups,
  canAdmin,
  dictionary,
  serverId,
  locale,
  timezone,
}: {
  events: EventRecord[];
  rosters: Roster[];
  squadPresets: SquadPreset[];
  users: AppUser[];
  userAssignments: ServerUserAssignment[];
  groups: Group[];
  canAdmin: boolean;
  dictionary: Dictionary;
  serverId: string;
  locale: string;
  timezone?: string;
}) {
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  const availableEvents = useMemo(() => {
    const rosterEventIds = new Set(rosters.map((r) => r.eventId));
    return events.filter((e) => e.kind === "match" && !rosterEventIds.has(e.id));
  }, [events, rosters]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId),
    [events, selectedEventId]
  );

  const selectedPreset = useMemo(
    () => squadPresets.find((p) => p.id === selectedPresetId),
    [squadPresets, selectedPresetId]
  );

  const draftRoster = useMemo(() => {
    if (!selectedEvent || !selectedPreset) return undefined;

    const attendingUserIds = new Set(
      selectedEvent.signUps
        .filter((signUp) => signUp.group !== SIGNUP_NOT_ATTENDING)
        .map((signUp) => signUp.userId),
    );
    const reservePlayerIds = users
      .filter((user) => attendingUserIds.has(user.discordId))
      .sort((a, b) => (getUserScoreForGuild(b, serverId) - getUserScoreForGuild(a, serverId)) || a.name.localeCompare(b.name))
      .map((user) => user.discordId);
    const notAttendingPlayerIds = users
      .filter((user) => !attendingUserIds.has(user.discordId))
      .sort((a, b) => (getUserScoreForGuild(b, serverId) - getUserScoreForGuild(a, serverId)) || a.name.localeCompare(b.name))
      .map((user) => user.discordId);

    return {
      id: "draft-roster",
      eventId: selectedEvent.id,
      guildId: serverId,
      squadPresetId: selectedPreset.id,
      squads: selectedPreset.squads.map((squad) => ({
        name: squad.name,
        group: squad.group,
        order: squad.order,
        color: squad.color,
        icon: squad.icon,
        players: squad.roles.flatMap((role) =>
          Array.from({ length: role.count }).map(() => ({
            roleName: role.name,
            roleIcon: role.icon,
            ack: false,
            confirmed: false,
            note: role.note,
          }))
        ),
      })),
      reservePlayerIds,
      reserveAttendances: reservePlayerIds.map((userId) => ({
        userId,
        ack: false,
        confirmed: false,
      })),
      notAttendingPlayerIds,
      published: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Roster;
  }, [selectedEvent, selectedPreset, serverId, users]);
  const showSetupCard = !selectedEvent || !selectedPreset;

  return (
    <div className="space-y-6">
      {showSetupCard ? (
        <Card className="rounded-2xl border-border/70 bg-card">
          <CardHeader>
            <CardTitle className="text-lg">{dictionary.roster.setupRoster}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{dictionary.roster.selectEvent}</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={dictionary.roster.selectEventPlaceholder} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {availableEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name} ({formatDateTime(event.meetingStart, timezone)})
                    </SelectItem>
                  ))}
                  {availableEvents.length === 0 && (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      {dictionary.roster.noEventsAvailable}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{dictionary.roster.selectPreset}</Label>
              <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={dictionary.roster.selectPresetPlaceholder} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {squadPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {draftRoster && selectedEvent ? (
        <RosterBoard
          roster={draftRoster}
          event={selectedEvent}
          users={users}
          userAssignments={userAssignments}
          groups={groups}
          canAdmin={canAdmin}
          dictionary={dictionary}
          serverId={serverId}
          locale={locale}
          timezone={timezone}
          defaultMode="assignment"
        />
      ) : (
        <div className="flex h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/50 bg-muted/20 text-muted-foreground">
          <p>{dictionary.roster.selectEventAndPresetToStart}</p>
        </div>
      )}
    </div>
  );
}
