"use client";

import { Ban, CalendarClock, Check, Clock3, GripVertical, MessageCircleOff, UserPlus } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupInlineIcons } from "@/components/app/group-inline-icons";
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
import { getUserScoreForGuild } from "@/lib/user-scores";
import type { AppUser, Group, Roster } from "@/types/domain";
import type { DragState } from "@/components/app/roster-board-types";

type RosterUser = AppUser & { _reserveSection?: string; signupRoleLabel?: string };

export function RosterBoardAttendeeLists({
  board,
  users,
  reserveUsers,
  groupedNotAttendingUsers,
  allUsersSorted,
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
  serverDiscordId,
  noticeReasonByUserId,
  notAttendingIndicatorByUserId,
}: {
  board: Roster;
  users: AppUser[];
  reserveUsers: RosterUser[];
  groupedNotAttendingUsers: RosterUser[];
  allUsersSorted: AppUser[];
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
  serverDiscordId: string;
  noticeReasonByUserId: Map<string, string>;
  notAttendingIndicatorByUserId: Map<string, "declined" | "no_response">;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="gap-0 rounded-2xl border-border/70 bg-card" onDragOver={(event) => isAssignmentMode && event.preventDefault()} onDrop={() => handleDropOnReserve()}>
        <CardHeader className="grid grid-rows-[1.5rem_2rem] gap-2 p-4">
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
                        {allUsersSorted.map((user) => (
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
        <CardContent className="p-4 pt-0">
          <ScrollArea className="h-[11rem] pr-1">
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
              serverDiscordId={serverDiscordId}
              noticeReasonByUserId={noticeReasonByUserId}
              notAttendingIndicatorByUserId={new Map()}
            />
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="gap-0 rounded-2xl border-border/70 bg-card" onDragOver={(event) => isAssignmentMode && event.preventDefault()} onDrop={() => handleDropOnNotAttending()}>
        <CardHeader className="grid grid-rows-[1.5rem_2rem] gap-2 p-4">
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
                        {allUsersSorted.map((user) => (
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
        <CardContent className="p-4 pt-0">
          <ScrollArea className="h-[11rem] pr-1">
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
              serverDiscordId={serverDiscordId}
              noticeReasonByUserId={noticeReasonByUserId}
              notAttendingIndicatorByUserId={notAttendingIndicatorByUserId}
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
  serverDiscordId,
  noticeReasonByUserId,
  notAttendingIndicatorByUserId,
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
  serverDiscordId: string;
  noticeReasonByUserId: Map<string, string>;
  notAttendingIndicatorByUserId: Map<string, "declined" | "no_response">;
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
          <div className="flex flex-wrap gap-2">
            {sections[sectionName].map((user) => {
              const assignment = assignmentsByUserId.get(user.discordId);
              const isReserveMember = assignment?.type === "reserve_member" && assignment.status === "active";
              const noticeReason = noticeReasonByUserId.get(user.discordId);
              const notAttendingIndicator = notAttendingIndicatorByUserId.get(user.discordId);

              return (
                <div
                  key={user.id}
                  onDragOver={(event) => isAssignmentMode && event.preventDefault()}
                  onDrop={() => onDropUser(user.discordId)}
                  className="basis-full md:basis-[calc(50%-0.25rem)]"
                >
                  <div
                    draggable={isAssignmentMode && canAdmin}
                    onDragStart={() => setDragState({ type: dragType, userId: user.discordId })}
                    onDragEnd={() => setDragState(null)}
                    className={[
                      "flex min-h-9 min-w-0 cursor-grab items-center gap-2 rounded-lg border border-border/70 bg-background p-2",
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
                        {user.note ? (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <div className="truncate text-xs font-medium leading-none">{user.name}</div>
                            </HoverCardTrigger>
                            <HoverCardContent className="max-w-64 whitespace-pre-wrap text-xs">
                              {user.note}
                            </HoverCardContent>
                          </HoverCard>
                        ) : (
                          <div className="truncate text-xs font-medium leading-none">{user.name}</div>
                        )}
                        {isReserveMember ? (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <CalendarClock className="size-3.5 text-amber-500" />
                            </HoverCardTrigger>
                            <HoverCardContent className="text-xs">
                              {dictionary.userManagement.reserveMemberLabel}
                            </HoverCardContent>
                          </HoverCard>
                        ) : null}
                        {noticeReason ? (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <Clock3 className="size-3.5 text-red-500" />
                            </HoverCardTrigger>
                            <HoverCardContent className="max-w-64 whitespace-pre-wrap text-xs">
                              {noticeReason}
                            </HoverCardContent>
                          </HoverCard>
                        ) : null}
                        {notAttendingIndicator ? (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              {notAttendingIndicator === "declined" ? (
                                <Ban className="size-3.5 text-amber-500" />
                              ) : (
                                <MessageCircleOff className="size-3.5 text-muted-foreground" />
                              )}
                            </HoverCardTrigger>
                            <HoverCardContent className="text-xs">
                              {notAttendingIndicator === "declined"
                                ? dictionary.roster.declinedSignup
                                : dictionary.roster.noSignupResponse}
                            </HoverCardContent>
                          </HoverCard>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <GroupInlineIcons
                          assignment={assignment}
                          groupsById={groupsById}
                          signupGroupName={user.signupRoleLabel}
                        />
                        <span className="truncate">{formatRosterScoreline(user, dictionary, serverDiscordId)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {!users.length ? (
        <div className="rounded-lg border border-dashed border-border/80 p-2 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      ) : null}
    </div>
  );
}

function formatRosterScoreline(user: AppUser, dictionary: Dictionary, serverDiscordId: string) {
  const score = getUserScoreForGuild(user, serverDiscordId);
  const kd = user.performance?.averages.killDeathRatio;
  if (typeof kd !== "number") {
    return `${score} ${dictionary.navUser.scoreSuffix}`;
  }

  return `${score} ${dictionary.navUser.scoreSuffix} • ${dictionary.userManagement.matchKd} ${kd.toFixed(kd % 1 === 0 ? 0 : 2)}`;
}

