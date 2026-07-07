"use client";

import { useState, useMemo } from "react";
import { RosterBoard } from "@/components/app/roster-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ServerUserAssignment } from "@/lib/server-user-management";
import type { AppUser, EventRecord, Group, Roster, SquadPreset } from "@/types/domain";
import { formatDateTime } from "@/lib/format";

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
}) {
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  const availableEvents = useMemo(() => {
    const rosterEventIds = new Set(rosters.map((r) => r.eventId));
    return events.filter((e) => !rosterEventIds.has(e.id));
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
            ack: false,
            note: role.note,
          }))
        ),
      })),
      reservePlayerIds: users.map((user) => user.id),
      notAttendingPlayerIds: [],
      published: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Roster;
  }, [selectedEvent, selectedPreset, serverId, users]);

  return (
    <div className="space-y-6">
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
                    {event.name} ({formatDateTime(event.meetingStart)})
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

      {draftRoster && selectedEvent ? (
        <RosterBoard
          roster={draftRoster}
          event={selectedEvent}
          users={users}
          userAssignments={userAssignments}
          groups={groups}
          canAdmin={canAdmin}
          dictionary={dictionary}
          defaultEditMode={true}
        />
      ) : (
        <div className="flex h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/50 bg-muted/20 text-muted-foreground">
          <p>{dictionary.roster.selectEventAndPresetToStart}</p>
        </div>
      )}
    </div>
  );
}
