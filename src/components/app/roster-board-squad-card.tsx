"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronsUpDown,
  Circle,
  Clock3,
  GripVertical,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getUserScoreForGuild } from "@/lib/user-scores";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ServerUserAssignment } from "@/lib/server-user-management";
import type { AppUser, Group, Roster } from "@/types/domain";
import { roleIconOptions } from "@/lib/squad-preset-templates";
import type { AttendanceStatus, DragState, RosterBoardMode } from "@/components/app/roster-board-types";

function getCustomPlayerName(player: Roster["squads"][number]["players"][number]) {
  return player.customName?.trim() || undefined;
}

function getAttendanceStatus(player: Roster["squads"][number]["players"][number]): AttendanceStatus {
  if (player.confirmed) return "confirmed";
  if (player.ack) return "acknowledged";
  return "pending";
}

function getAttendanceIcon(status: AttendanceStatus) {
  if (status === "confirmed") {
    return <CheckCircle2 className="size-4 text-emerald-500" />;
  }

  if (status === "acknowledged") {
    return <CheckCircle2 className="size-4 text-foreground" />;
  }

  return <XCircle className="size-4 text-muted-foreground" />;
}

function compareUsersByScoreThenName(a: AppUser, b: AppUser, serverDiscordId: string) {
  return (getUserScoreForGuild(b, serverDiscordId) - getUserScoreForGuild(a, serverDiscordId)) || a.name.localeCompare(b.name);
}

function formatRosterScoreline(user: AppUser, dictionary: Dictionary, serverDiscordId: string) {
  const score = getUserScoreForGuild(user, serverDiscordId);
  const kd = user.performance?.averages.killDeathRatio;
  if (typeof kd !== "number") {
    return `${score} ${dictionary.navUser.scoreSuffix}`;
  }

  return `${score} ${dictionary.navUser.scoreSuffix} • ${dictionary.userManagement.matchKd} ${kd.toFixed(kd % 1 === 0 ? 0 : 2)}`;
}

function getPrimaryGroupLabel(
  assignment: ServerUserAssignment | undefined,
  groupsById: Map<string, Group>,
  dictionary: Dictionary,
) {
  const primaryGroup = assignment?.primaryGroupId ? groupsById.get(assignment.primaryGroupId) : undefined;
  return primaryGroup?.name ?? dictionary.shared.notSet;
}

function getSecondaryGroupLabel(
  assignment: ServerUserAssignment | undefined,
  groupsById: Map<string, Group>,
  dictionary: Dictionary,
) {
  const secondaryGroups = (assignment?.secondaryGroupIds || [])
    .map((groupId) => groupsById.get(groupId as never)?.name)
    .filter(Boolean) as string[];

  return secondaryGroups.length ? secondaryGroups.join(", ") : dictionary.userManagement.noSecondaryGroups;
}

function GroupBadge({
  assignment,
  groupsById,
  dictionary,
}: {
  assignment?: ServerUserAssignment;
  groupsById: Map<string, Group>;
  dictionary: Dictionary;
}) {
  const primaryGroup = assignment?.primaryGroupId ? groupsById.get(assignment.primaryGroupId) : undefined;
  const secondaryGroups = (assignment?.secondaryGroupIds || [])
    .map((groupId) => groupsById.get(groupId as never))
    .filter((group): group is Group => Boolean(group)) ?? [];

  if (!primaryGroup) {
    return null;
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Badge variant="secondary" className="max-w-full rounded-full px-2 py-0 text-[10px]">
          {primaryGroup.name}
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent className="space-y-2">
        <div className="font-medium">{primaryGroup.name}</div>
        <div className="text-xs text-muted-foreground">
          {secondaryGroups.length ? secondaryGroups.map((group) => group.name).join(", ") : dictionary.userManagement.noSecondaryGroups}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function SquadCard({
  squad,
  board,
  squadIndex,
  mode,
  dictionary,
  setFocusedGroup,
  updateSquadField,
  removeRosterSquad,
  moveSquad,
  updatePlayerField,
  updatePlayerIcon,
  updatePlayerAttendanceStatus,
  removeRosterSlot,
  moveSlotToReserve,
  moveSlotToNotAttending,
  clearSlotAssignment,
  handleDropOnSlot,
  addRosterSlot,
  assignUserToSlot,
  assignPlaceholderToSlot,
  allUsersSorted,
  usersById,
  assignmentsByUserId,
  groupsById,
  canAdmin,
  setDragState,
  serverDiscordId,
  noticeReasonByUserId,
}: {
  squad: Roster["squads"][0];
  board: Roster;
  squadIndex: number;
  mode: RosterBoardMode;
  dictionary: Dictionary;
  setFocusedGroup: (group: string) => void;
  updateSquadField: (index: number, field: "name" | "group" | "color", value: string) => void;
  removeRosterSquad: (index: number) => void;
  moveSquad: (index: number, direction: -1 | 1) => void;
  updatePlayerField: (sIndex: number, pIndex: number, field: "note" | "roleName", value: string) => void;
  updatePlayerIcon: (sIndex: number, pIndex: number, roleIcon: string) => void;
  updatePlayerAttendanceStatus: (sIndex: number, pIndex: number, status: AttendanceStatus) => void;
  removeRosterSlot: (sIndex: number, pIndex: number) => void;
  moveSlotToReserve: (sIndex: number, pIndex: number, targetReserveId?: string) => void;
  moveSlotToNotAttending: (sIndex: number, pIndex: number) => void;
  clearSlotAssignment: (sIndex: number, pIndex: number) => void;
  handleDropOnSlot: (sIndex: number, pIndex: number) => void;
  addRosterSlot: (index: number) => void;
  assignUserToSlot: (userId: string, sIndex: number, pIndex: number) => void;
  assignPlaceholderToSlot: (customName: string, sIndex: number, pIndex: number) => void;
  allUsersSorted: AppUser[];
  usersById: Map<string, AppUser>;
  assignmentsByUserId: Map<string, ServerUserAssignment>;
  groupsById: Map<string, Group>;
  canAdmin: boolean;
  setDragState: (state: DragState | null) => void;
  serverDiscordId: string;
  noticeReasonByUserId: Map<string, string>;
}) {
  const [slotPickerOpen, setSlotPickerOpen] = useState<number | null>(null);
  const [slotSearches, setSlotSearches] = useState<Record<number, string>>({});
  const [moveMenuOpen, setMoveMenuOpen] = useState<number | null>(null);
  const [attendanceMenuOpen, setAttendanceMenuOpen] = useState<number | null>(null);
  const isLayoutMode = mode === "layout";
  const isAssignmentMode = mode === "assignment";
  const isViewMode = mode === "view";

  return (
    <Card
      className="rounded-2xl border-border/70 bg-card p-4 gap-2"
      style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${squad.color} 60%, transparent)` }}
      onClick={() => setFocusedGroup(squad.group)}
    >
      <CardHeader className="px-0">
        {isLayoutMode ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{dictionary.roster.squadSetup}</div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="size-8 rounded-xl" onClick={(e) => { e.stopPropagation(); removeRosterSquad(squadIndex); }}>
                  <Trash2 className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8 rounded-xl" onClick={(e) => { e.stopPropagation(); moveSquad(squadIndex, -1); }}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8 rounded-xl" onClick={(e) => { e.stopPropagation(); moveSquad(squadIndex, 1); }}>
                  <ArrowDown className="size-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-row gap-3">
              <Input defaultValue={squad.name} onBlur={(event) => updateSquadField(squadIndex, "name", event.target.value)} className="h-9 rounded-xl p-2" />
              <Input defaultValue={squad.group} onBlur={(event) => updateSquadField(squadIndex, "group", event.target.value)} className="h-9 rounded-xl p-2" />
              <Input type="color" value={squad.color} onChange={(event) => updateSquadField(squadIndex, "color", event.target.value)} className="h-9 rounded-xl p-2" />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="cursor-pointer text-sm leading-none" onClick={() => setFocusedGroup(squad.group)}>{squad.name}</CardTitle>
              <div className="cursor-pointer pt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground" onClick={() => setFocusedGroup(squad.group)}>{squad.group}</div>
            </div>
            <Badge className="rounded-full border-0 px-2 py-0 text-[10px]" style={{ backgroundColor: squad.color, color: "#08111f" }}>
              {squad.players.length} slots
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-1.5 px-0">
        {squad.players.map((player, playerIndex) => {
          const slotUser = player.id ? usersById.get(player.id) : undefined;
          const placeholderName = getCustomPlayerName(player);
          const assignment = slotUser ? assignmentsByUserId.get(slotUser.discordId) : undefined;
          const attendanceStatus = getAttendanceStatus(player);
          const noticeReason = slotUser ? noticeReasonByUserId.get(slotUser.discordId) : undefined;

          return (
            <div
              key={`${squadIndex}-${playerIndex}`}
              onDragOver={(event) => {
                if (isAssignmentMode) event.preventDefault();
              }}
              onDrop={() => handleDropOnSlot(squadIndex, playerIndex)}
              className={cn(
                "rounded-xl border border-border/70 bg-muted/20",
                isViewMode ? "p-1" : "p-1.5",
              )}
            >
              <div className="mb-1.5 flex items-center justify-between gap-1.5">
                {isLayoutMode ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <RoleIconSelect value={player.roleIcon} onChange={(value) => updatePlayerIcon(squadIndex, playerIndex, value)} />
                    <Input defaultValue={player.roleName ?? ""} onBlur={(event) => updatePlayerField(squadIndex, playerIndex, "roleName", event.target.value)} className="h-8 rounded-lg px-2 text-xs" />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {player.roleIcon ? <Image src={player.roleIcon} alt="" width={12} height={12} className="size-3 object-contain invert dark:invert-0" /> : null}
                    <span>{player.roleName ?? dictionary.roster.role}</span>
                  </div>
                )}
                {isLayoutMode ? (
                  <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg" onClick={() => removeRosterSlot(squadIndex, playerIndex)}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              {slotUser || placeholderName ? (
                <div>
                  {!isLayoutMode ? (
                    <div
                      draggable={Boolean(slotUser) && isAssignmentMode && canAdmin}
                      onDragStart={() => {
                        if (!slotUser) return;
                        setDragState({ type: "slot", squadIndex, playerIndex });
                      }}
                      onDragEnd={() => setDragState(null)}
                      className={cn(
                        "flex min-w-0 items-center rounded-lg border border-border/60 bg-background",
                        isAssignmentMode && canAdmin && slotUser ? "cursor-grab gap-1.5 px-1.5 py-1" : "gap-1 px-1.5 py-1",
                      )}
                    >
                      {isAssignmentMode && canAdmin && slotUser ? <GripVertical className="size-4 text-muted-foreground" /> : null}
                      <Avatar className={cn("shrink-0 rounded-md", isViewMode ? "size-5" : "size-6")}>
                        {slotUser ? <AvatarImage src={slotUser.avatar} alt={slotUser.name} /> : null}
                        <AvatarFallback>{(slotUser?.name ?? placeholderName ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="truncate text-xs font-medium leading-none">
                            {slotUser ? slotUser.name : placeholderName}{" "}
                            <span className="text-[10px] text-muted-foreground">
                              ({slotUser ? formatRosterScoreline(slotUser, dictionary, serverDiscordId) : `0 ${dictionary.navUser.scoreSuffix}`})
                            </span>
                          </div>
                          {slotUser ? <GroupBadge assignment={assignment} groupsById={groupsById} dictionary={dictionary} /> : null}
                          {noticeReason ? (
                            <HoverCard>
                              <HoverCardTrigger asChild>
                                <Clock3 className="size-3.5 text-red-500" />
                              </HoverCardTrigger>
                              <HoverCardContent className="text-xs">
                                {noticeReason}
                              </HoverCardContent>
                            </HoverCard>
                          ) : null}
                        </div>
                      </div>
                      {player.note && !isAssignmentMode ? (
                        <div className="max-w-28 truncate text-[10px] text-muted-foreground">{player.note}</div>
                      ) : null}
                      {isAssignmentMode && canAdmin ? (
                        <Popover open={moveMenuOpen === playerIndex} onOpenChange={(open) => setMoveMenuOpen(open ? playerIndex : null)}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-6 rounded-lg"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                              onPointerDown={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <ChevronsUpDown className="size-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="end">
                            <div className="flex flex-col gap-1">
                              {slotUser ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="justify-start rounded-lg"
                                    onClick={() => {
                                      moveSlotToReserve(squadIndex, playerIndex);
                                      setMoveMenuOpen(null);
                                    }}
                                  >
                                    {dictionary.roster.moveToReserves}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="justify-start rounded-lg"
                                    onClick={() => {
                                      moveSlotToNotAttending(squadIndex, playerIndex);
                                      setMoveMenuOpen(null);
                                    }}
                                  >
                                    {dictionary.roster.moveToNotAttending}
                                  </Button>
                                </>
                              ) : null}
                              <Button
                                type="button"
                                variant="ghost"
                                className="justify-start rounded-lg"
                                onClick={() => {
                                  clearSlotAssignment(squadIndex, playerIndex);
                                  setMoveMenuOpen(null);
                                }}
                              >
                                {dictionary.common.clear}
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : null}
                      {isAssignmentMode && slotUser ? (
                        <Popover open={attendanceMenuOpen === playerIndex} onOpenChange={(open) => setAttendanceMenuOpen(open ? playerIndex : null)}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-6 rounded-lg"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                              onPointerDown={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              {getAttendanceIcon(attendanceStatus)}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-44 p-1" align="end">
                            <div className="flex flex-col gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                className="justify-start rounded-lg px-2 py-1 text-xs"
                                onClick={() => {
                                  updatePlayerAttendanceStatus(squadIndex, playerIndex, "pending");
                                  setAttendanceMenuOpen(null);
                                }}
                              >
                                {getAttendanceIcon("pending")}
                                {dictionary.roster.attendancePending}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="justify-start rounded-lg px-2 py-1 text-xs"
                                onClick={() => {
                                  updatePlayerAttendanceStatus(squadIndex, playerIndex, "acknowledged");
                                  setAttendanceMenuOpen(null);
                                }}
                              >
                                {getAttendanceIcon("acknowledged")}
                                {dictionary.roster.attendanceAcknowledged}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="justify-start rounded-lg px-2 py-1 text-xs"
                                onClick={() => {
                                  updatePlayerAttendanceStatus(squadIndex, playerIndex, "confirmed");
                                  setAttendanceMenuOpen(null);
                                }}
                              >
                                {getAttendanceIcon("confirmed")}
                                {dictionary.roster.attendanceConfirmed}
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        slotUser ? getAttendanceIcon(attendanceStatus) : <Circle className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  ) : null}
                  {isLayoutMode ? (
                    <div className="mt-2">
                      <Input
                        defaultValue={player.note ?? ""}
                        onBlur={(event) => updatePlayerField(squadIndex, playerIndex, "note", event.target.value)}
                        placeholder={dictionary.common.slotNote}
                        className="h-6 w-full rounded-md border-border/50 bg-muted/40 px-2 text-[10px]"
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                isLayoutMode ? (
                  <div className="mt-2">
                    <Input
                      defaultValue={player.note ?? ""}
                      onBlur={(event) => updatePlayerField(squadIndex, playerIndex, "note", event.target.value)}
                      placeholder={dictionary.common.slotNote}
                      className="h-6 w-full rounded-md border-border/50 bg-muted/40 px-2 text-[10px]"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="flex min-w-0 items-center gap-1 rounded-lg border border-dashed border-border/80 bg-background px-1.5 py-1">
                      <Popover open={isAssignmentMode && slotPickerOpen === playerIndex} onOpenChange={(open) => setSlotPickerOpen(open ? playerIndex : null)}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            disabled={!isAssignmentMode}
                            className={cn(
                              "min-w-0 flex-1 text-left leading-none text-muted-foreground",
                              isAssignmentMode ? "cursor-pointer text-xs" : "cursor-default text-xs",
                            )}
                          >
                            <span className="block truncate">{dictionary.common.openSlot}</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              value={slotSearches[playerIndex] ?? ""}
                              onValueChange={(value) => setSlotSearches((current) => ({ ...current, [playerIndex]: value }))}
                              placeholder={dictionary.common.openSlot}
                            />
                            <CommandList>
                              <CommandEmpty>{dictionary.userManagement.noResults}</CommandEmpty>
                              {(slotSearches[playerIndex] ?? "").trim() ? (
                                <CommandGroup>
                                  <CommandItem
                                    value={(slotSearches[playerIndex] ?? "").trim()}
                                    onSelect={() => {
                                      assignPlaceholderToSlot((slotSearches[playerIndex] ?? "").trim(), squadIndex, playerIndex);
                                      setSlotPickerOpen(null);
                                      setSlotSearches((current) => ({ ...current, [playerIndex]: "" }));
                                    }}
                                  >
                                    <Avatar className="mr-2 size-6 rounded-sm">
                                      <AvatarFallback>{(slotSearches[playerIndex] ?? "").trim().slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate">{(slotSearches[playerIndex] ?? "").trim()}</div>
                                      <div className="truncate text-xs text-muted-foreground">
                                        Saved as a typed roster placeholder
                                      </div>
                                    </div>
                                    <Plus className="ml-auto size-4" />
                                  </CommandItem>
                                </CommandGroup>
                              ) : null}
                              <CommandGroup>
                                {allUsersSorted
                                  .filter((user) => user.name.toLowerCase().includes((slotSearches[playerIndex] ?? "").trim().toLowerCase()))
                                  .sort((a, b) => {
                                    const aAssignedElsewhere = board.squads.some((currentSquad, currentSquadIndex) =>
                                      currentSquad.players.some(
                                        (currentPlayer, currentPlayerIndex) =>
                                          !(currentSquadIndex === squadIndex && currentPlayerIndex === playerIndex) &&
                                          currentPlayer.id === a.discordId,
                                      ),
                                    );
                                    const bAssignedElsewhere = board.squads.some((currentSquad, currentSquadIndex) =>
                                      currentSquad.players.some(
                                        (currentPlayer, currentPlayerIndex) =>
                                          !(currentSquadIndex === squadIndex && currentPlayerIndex === playerIndex) &&
                                          currentPlayer.id === b.discordId,
                                      ),
                                    );

                                    if (aAssignedElsewhere !== bAssignedElsewhere) {
                                      return aAssignedElsewhere ? 1 : -1;
                                    }

                                    return compareUsersByScoreThenName(a, b, serverDiscordId);
                                  })
                                  .slice(0, 5)
                                  .map((user) => {
                                    const assignment = assignmentsByUserId.get(user.discordId);
                                    const assignedElsewhere = board.squads.some((currentSquad, currentSquadIndex) =>
                                      currentSquad.players.some(
                                        (currentPlayer, currentPlayerIndex) =>
                                          !(currentSquadIndex === squadIndex && currentPlayerIndex === playerIndex) &&
                                          currentPlayer.id === user.discordId,
                                      ),
                                    );

                                    return (
                                      <CommandItem
                                        key={user.id}
                                        value={user.name}
                                        className={cn(
                                          assignedElsewhere && "bg-amber-500/10 text-amber-100 data-[selected=true]:bg-amber-500/20",
                                        )}
                                        onSelect={() => {
                                          assignUserToSlot(user.discordId, squadIndex, playerIndex);
                                          setSlotPickerOpen(null);
                                          setSlotSearches((current) => ({ ...current, [playerIndex]: "" }));
                                        }}
                                      >
                                        <Avatar className="mr-2 size-6 rounded-sm">
                                          <AvatarImage src={user.avatar} alt={user.name} />
                                          <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate">{user.name}</div>
                                          <div className="truncate text-xs text-muted-foreground">
                                            {getPrimaryGroupLabel(assignment, groupsById, dictionary)} • {formatRosterScoreline(user, dictionary, serverDiscordId)}
                                          </div>
                                          <div className="truncate text-xs text-muted-foreground/80">
                                            {getSecondaryGroupLabel(assignment, groupsById, dictionary)}
                                          </div>
                                        </div>
                                        {assignedElsewhere ? <ChevronsUpDown className="ml-auto size-4" /> : null}
                                      </CommandItem>
                                    );
                                  })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {player.note && !isAssignmentMode ? (
                        <div className="max-w-28 truncate text-[10px] text-muted-foreground">{player.note}</div>
                      ) : null}
                    </div>
                  </div>
                )
              )}
            </div>
          );
        })}
        {isLayoutMode ? (
          <Button variant="outline" className="h-9 w-full rounded-xl" onClick={() => addRosterSlot(squadIndex)}>
            <Plus className="size-4" />
            {dictionary.roster.addSlot}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RoleIconSelect({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string) => void;
}) {
  const selectedValue = value && roleIconOptions.includes(value as (typeof roleIconOptions)[number])
    ? value
    : roleIconOptions[0];

  return (
    <Select value={selectedValue} onValueChange={onChange}>
      <SelectTrigger className="h-7 min-h-7 w-16 rounded-lg px-1.5 py-0 [&_svg]:size-3 [&_svg]:shrink-0">
        <SelectValue>
          <Image src={selectedValue} alt="" width={20} height={14} className="h-3.5 w-5 object-contain invert dark:invert-0" />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {roleIconOptions.map((iconPath) => (
          <SelectItem key={iconPath} value={iconPath}>
            <Image src={iconPath} alt="" width={20} height={14} className="h-3.5 w-5 object-contain invert dark:invert-0" />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
