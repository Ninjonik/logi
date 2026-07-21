"use client";

import { Check, GripVertical, UserPlus } from "lucide-react";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ServerUserAssignment } from "@/lib/server-user-management";
import type { AppUser, Group, Roster } from "@/types/domain";
import type { DragState } from "@/components/app/roster-board-types";

type RosterUser = AppUser & { _reserveSection?: string };

export function RosterBoardAttendeeLists({
  board,
  users,
  reserveUsers,
  groupedNotAttendingUsers,
  assignmentsByUserId,
  groupsById,
  dictionary,
  reserveSearch,
  setReserveSearch,
  notAttendingSearch,
  setNotAttendingSearch,
  focusedGroup,
  isAssignmentMode,
  canAdmin,
  userPickerOpen,
  setUserPickerOpen,
  notAttendingPickerOpen,
  setNotAttendingPickerOpen,
  addPlayerToReserve,
  addPlayerToNotAttending,
  handleDropOnReserve,
  handleDropOnNotAttending,
  setDragState,
}: {
  board: Roster;
  users: AppUser[];
  reserveUsers: RosterUser[];
  groupedNotAttendingUsers: RosterUser[];
  assignmentsByUserId: Map<string, ServerUserAssignment>;
  groupsById: Map<string, Group>;
  dictionary: Dictionary;
  reserveSearch: string;
  setReserveSearch: (value: string) => void;
  notAttendingSearch: string;
  setNotAttendingSearch: (value: string) => void;
  focusedGroup: string | null;
  isAssignmentMode: boolean;
  canAdmin: boolean;
  userPickerOpen: boolean;
  setUserPickerOpen: (open: boolean) => void;
  notAttendingPickerOpen: boolean;
  setNotAttendingPickerOpen: (open: boolean) => void;
  addPlayerToReserve: (userId: string) => void;
  addPlayerToNotAttending: (userId: string) => void;
  handleDropOnReserve: (targetReserveId?: string) => void;
  handleDropOnNotAttending: () => void;
  setDragState: (state: DragState | null) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="gap-0 rounded-2xl border-border/70 bg-card" onDragOver={(event) => isAssignmentMode && event.preventDefault()} onDrop={() => handleDropOnReserve()}>
        <CardHeader className="grid grid-rows-[1.5rem_2rem] gap-3 px-6 pb-4 pt-6">
          <div className="flex h-6 items-center justify-between">
            <CardTitle className="text-sm">{dictionary.common.reserves}</CardTitle>
            {isAssignmentMode && (
              <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-lg"
                    onClick={(event) => {
                      event.stopPropagation();
                      setUserPickerOpen(true);
                    }}
                  >
                    <UserPlus className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder={dictionary.common.searchReserves} />
                    <CommandList>
                      <CommandEmpty>{dictionary.userManagement.noResults}</CommandEmpty>
                      <CommandGroup>
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.name}
                            onSelect={() => {
                              addPlayerToReserve(user.discordId);
                              setUserPickerOpen(false);
                            }}
                          >
                            <Avatar className="mr-2 size-6 rounded-sm">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{user.name}</span>
                            {board.reservePlayerIds?.includes(user.discordId) && (
                              <Check className="ml-auto size-4" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <Input
            value={reserveSearch}
            onChange={(event) => setReserveSearch(event.target.value)}
            placeholder={dictionary.common.searchReserves}
            className="h-8 rounded-xl px-2 text-xs"
          />
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <ScrollArea className="pr-1">
            <GroupedUserList
              users={reserveUsers}
              dictionary={dictionary}
              assignmentsByUserId={assignmentsByUserId}
              groupsById={groupsById}
              isAssignmentMode={isAssignmentMode}
              canAdmin={canAdmin}
              focusedGroup={focusedGroup}
              emptyLabel={dictionary.userManagement.noResults}
              dragType="reserve"
              onDropUser={(userId) => handleDropOnReserve(userId)}
              setDragState={setDragState}
            />
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="gap-0 rounded-2xl border-border/70 bg-card" onDragOver={(event) => isAssignmentMode && event.preventDefault()} onDrop={() => handleDropOnNotAttending()}>
        <CardHeader className="grid grid-rows-[1.5rem_2rem] gap-3 px-6 pb-4 pt-6">
          <div className="flex h-6 items-center justify-between">
            <CardTitle className="text-sm">{dictionary.roster.notAttending}</CardTitle>
            {isAssignmentMode && (
              <Popover open={notAttendingPickerOpen} onOpenChange={setNotAttendingPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-lg"
                    onClick={(event) => {
                      event.stopPropagation();
                      setNotAttendingPickerOpen(true);
                    }}
                  >
                    <UserPlus className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder={dictionary.common.searchNotAttending} />
                    <CommandList>
                      <CommandEmpty>{dictionary.userManagement.noResults}</CommandEmpty>
                      <CommandGroup>
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.name}
                            onSelect={() => {
                              addPlayerToNotAttending(user.discordId);
                              setNotAttendingPickerOpen(false);
                            }}
                          >
                            <Avatar className="mr-2 size-6 rounded-sm">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{user.name}</span>
                            {board.notAttendingPlayerIds?.includes(user.discordId) && (
                              <Check className="ml-auto size-4" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <Input
            value={notAttendingSearch}
            onChange={(event) => setNotAttendingSearch(event.target.value)}
            placeholder={dictionary.common.searchNotAttending}
            className="h-8 rounded-xl px-2 text-xs"
          />
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <ScrollArea className="pr-1">
            <GroupedUserList
              users={groupedNotAttendingUsers}
              dictionary={dictionary}
              assignmentsByUserId={assignmentsByUserId}
              groupsById={groupsById}
              isAssignmentMode={isAssignmentMode}
              canAdmin={canAdmin}
              emptyLabel={dictionary.shared.nothingCreatedYet}
              dragType="notAttending"
              muted
              onDropUser={() => handleDropOnNotAttending()}
              setDragState={setDragState}
            />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function GroupedUserList({
  users,
  dictionary,
  assignmentsByUserId,
  groupsById,
  isAssignmentMode,
  canAdmin,
  focusedGroup,
  emptyLabel,
  dragType,
  muted,
  onDropUser,
  setDragState,
}: {
  users: RosterUser[];
  dictionary: Dictionary;
  assignmentsByUserId: Map<string, ServerUserAssignment>;
  groupsById: Map<string, Group>;
  isAssignmentMode: boolean;
  canAdmin: boolean;
  focusedGroup?: string | null;
  emptyLabel: string;
  dragType: "reserve" | "notAttending";
  muted?: boolean;
  onDropUser: (userId: string) => void;
  setDragState: (state: DragState | null) => void;
}) {
  const sections: Record<string, RosterUser[]> = {};
  users.forEach((user) => {
    const section = user._reserveSection || dictionary.shared.notSet;
    if (!sections[section]) sections[section] = [];
    sections[section].push(user);
  });

  const sectionOrder = Object.keys(sections).sort((a, b) => {
    if (focusedGroup && a === focusedGroup) return -1;
    if (focusedGroup && b === focusedGroup) return 1;
    return a.localeCompare(b);
  });
  const showSectionHeaders = Boolean(focusedGroup) || sectionOrder.length > 1;

  return (
    <div className="space-y-2">
      {sectionOrder.map((sectionName) => (
        <div key={sectionName} className="space-y-2">
          {showSectionHeaders && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                {sectionName}
              </span>
              <div className="h-px flex-1 bg-border/40" />
            </div>
          )}
          {sections[sectionName].map((user) => {
            const assignment = assignmentsByUserId.get(user.discordId);

            return (
              <div
                key={user.id}
                onDragOver={(event) => isAssignmentMode && event.preventDefault()}
                onDrop={() => onDropUser(user.discordId)}
              >
                <div
                  draggable={isAssignmentMode && canAdmin}
                  onDragStart={() => setDragState({ type: dragType, userId: user.discordId })}
                  onDragEnd={() => setDragState(null)}
                  className={[
                    "flex min-h-10 min-w-0 cursor-grab items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2",
                    muted ? "opacity-60" : "",
                  ].join(" ")}
                >
                  {isAssignmentMode && canAdmin ? <GripVertical className="size-4 text-muted-foreground" /> : null}
                  <Avatar className="size-5 shrink-0 rounded-md">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <div className="truncate text-xs font-medium leading-none">{user.name}</div>
                      <GroupBadge assignment={assignment} groupsById={groupsById} dictionary={dictionary} />
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">{formatRosterScoreline(user, dictionary)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {!users.length ? (
        <div className="rounded-lg border border-dashed border-border/80 px-2 py-4 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      ) : null}
    </div>
  );
}

function formatRosterScoreline(user: AppUser, dictionary: Dictionary) {
  const kd = user.performance?.averages.killDeathRatio;
  if (typeof kd !== "number") {
    return `${user.score} ${dictionary.navUser.scoreSuffix}`;
  }

  return `${user.score} ${dictionary.navUser.scoreSuffix} • ${dictionary.userManagement.matchKd} ${kd.toFixed(kd % 1 === 0 ? 0 : 2)}`;
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
