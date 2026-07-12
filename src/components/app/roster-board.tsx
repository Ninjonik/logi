"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Circle,
  CircleDot,
  GripVertical,
  Loader2,
  Plus,
  Radio,
  Save,
  Send,
  Settings2,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRouter } from "next/navigation";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ServerUserAssignment } from "@/lib/server-user-management";
import type { AppUser, EventRecord, Group, Roster } from "@/types/domain";
import { formatDateTime } from "@/lib/format";

type DragState =
  | { type: "reserve"; userId: string }
  | { type: "notAttending"; userId: string }
  | { type: "slot"; squadIndex: number; playerIndex: number };

export function RosterBoard({
  roster,
  event,
  users,
  userAssignments,
  groups,
  canAdmin,
  dictionary,
  serverId,
  locale,
  timezone,
  defaultEditMode = false,
}: {
  roster?: Roster;
  event?: EventRecord;
  users: AppUser[];
  userAssignments: ServerUserAssignment[];
  groups: Group[];
  canAdmin: boolean;
  dictionary: Dictionary;
  serverId: string;
  locale: string;
  timezone?: string;
  defaultEditMode: boolean;
}) {
  const router = useRouter();
  const [board, setBoard] = useState(roster);
  const [editMode, setEditMode] = useState(defaultEditMode);
  const [search, setSearch] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [focusedGroup, setFocusedGroup] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setBoard(roster);
  }, [roster]);

  const [isPending, startTransition] = useTransition();
  const upsertRoster = useMutation(api.rosters.upsert);

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const assignmentsByUserId = useMemo(() => new Map(userAssignments.map((assignment) => [assignment.userId, assignment])), [userAssignments]);
  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const allUsersSorted = useMemo(() => users.slice().sort((a, b) => a.name.localeCompare(b.name)), [users]);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const sortedSquads = useMemo(
    () => board?.squads.slice().sort((a, b) => a.order - b.order) ?? [],
    [board],
  );

  const squadGroups = useMemo(() => {
    if (!board) return [];
    const groupsMap = new Map<string, Group>();
    groups.forEach((g) => groupsMap.set(g.name, g));

    const squadByGroupName = new Map<string, typeof sortedSquads>();
    sortedSquads.forEach((squad) => {
      const list = squadByGroupName.get(squad.group) ?? [];
      list.push(squad);
      squadByGroupName.set(squad.group, list);
    });

    const rootGroups = groups
      .filter((g) => !g.parentId)
      .sort((a, b) => a.order - b.order);

    const result: { group: Group; subgroups: { group: Group; squads: typeof sortedSquads }[]; squads: typeof sortedSquads }[] = [];

    rootGroups.forEach((root) => {
      const subgroups = groups
        .filter((g) => g.parentId === root.id)
        .sort((a, b) => a.order - b.order)
        .map((sub) => ({
          group: sub,
          squads: squadByGroupName.get(sub.name) ?? [],
        }));

      result.push({
        group: root,
        subgroups,
        squads: squadByGroupName.get(root.name) ?? [],
      });

      squadByGroupName.delete(root.name);
      subgroups.forEach((sub) => squadByGroupName.delete(sub.group.name));
    });

    // Handle groups that are not in the groups list or not root/sub
    const remainingGroupNames = Array.from(squadByGroupName.keys()).sort();
    remainingGroupNames.forEach((groupName) => {
      const existingGroup = groups.find((g) => g.name === groupName);
      if (existingGroup) {
        // This group was not a root or a direct child of a root,
        // but it is a known group. We should probably show it as a root if it wasn't handled.
        // Check if it's already in the result via hierarchy
        const isHandled = result.some(r => r.group.id === existingGroup.id || r.subgroups.some(s => s.group.id === existingGroup.id));
        if (isHandled) return;

        result.push({
          group: existingGroup,
          subgroups: [],
          squads: squadByGroupName.get(groupName) ?? [],
        });
      } else {
        result.push({
          group: { name: groupName, color: "#64748b", order: 999 } as Group,
          subgroups: [],
          squads: squadByGroupName.get(groupName) ?? [],
        });
      }
    });

    return result;
  }, [board, groups, sortedSquads]);

  const assignedCount = useMemo(
    () => board?.squads.reduce((sum, squad) => sum + squad.players.filter((player) => player.id).length, 0) ?? 0,
    [board],
  );

  const totalSlots = useMemo(
    () => board?.squads.reduce((sum, squad) => sum + squad.players.length, 0) ?? 0,
    [board],
  );

  const reserveUsers = useMemo(() => {
    if (!board) return [];

    const filtered = (board.reservePlayerIds || [])
      .map((id) => usersById.get(id))
      .filter((user): user is AppUser => Boolean(user))
      .filter((user) => user.name.toLowerCase().includes(normalizedSearch));

    return filtered
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((user) => ({
        ...user,
        _reserveSection: getPrimaryGroupLabel(assignmentsByUserId.get(user.id), groupsById, dictionary),
      }));
  }, [assignmentsByUserId, board, focusedGroup, groups, groupsById, normalizedSearch, usersById]);

  const notAttendingUsers = useMemo(() => {
    if (!board) return [];
    return (board.notAttendingPlayerIds || [])
      .map((id) => usersById.get(id))
      .filter((user): user is AppUser => Boolean(user))
      .filter((user) => user.name.toLowerCase().includes(normalizedSearch));
  }, [board, normalizedSearch, usersById]);

  const groupedNotAttendingUsers = useMemo(
    () => notAttendingUsers.map((user) => ({
      ...user,
      _reserveSection: getPrimaryGroupLabel(assignmentsByUserId.get(user.id), groupsById, dictionary),
    })),
    [assignmentsByUserId, dictionary, groupsById, notAttendingUsers],
  );

  if (!event) {
    return (
      <Card className="rounded-2xl border-dashed border-border/80">
        <CardContent className="py-16 text-center text-muted-foreground">
          {dictionary.roster.rosterNotAssigned}
        </CardContent>
      </Card>
    );
  }

  if (!board) {
    return (
      <Card className="rounded-2xl border-dashed border-border/80">
        <CardContent className="py-16 text-center text-muted-foreground">
          {dictionary.roster.rosterNotCreated}
        </CardContent>
      </Card>
    );
  }

  if (!board.published && !canAdmin) {
    return (
      <Card className="rounded-2xl border-dashed border-border/80">
        <CardContent className="py-16 text-center text-muted-foreground">
          {dictionary.roster.rosterNotAvailable}
        </CardContent>
      </Card>
    );
  }

  function moveReserveToSlot(reserveUserId: string, squadIndex: number, playerIndex: number) {
    assignUserToSlot(reserveUserId, squadIndex, playerIndex);
  }

  function moveNotAttendingToSlot(userId: string, squadIndex: number, playerIndex: number) {
    assignUserToSlot(userId, squadIndex, playerIndex);
  }

  function assignUserToSlot(userId: string, squadIndex: number, playerIndex: number) {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const slot = next.squads[squadIndex]?.players[playerIndex];
      if (!slot) return current;

      next.reservePlayerIds = (next.reservePlayerIds || []).filter((id) => id !== userId);
      next.notAttendingPlayerIds = (next.notAttendingPlayerIds || []).filter((id) => id !== userId);

      next.squads.forEach((squad) => {
        squad.players.forEach((player) => {
          if (player.id === userId) {
            player.id = undefined;
            player.ack = false;
          }
        });
      });

      if (slot.id && slot.id !== userId) {
        const reserveIds = next.reservePlayerIds || (next.reservePlayerIds = []);
        if (!reserveIds.includes(slot.id)) {
          reserveIds.push(slot.id);
        }
      }

      slot.id = userId;
      slot.ack = false;
      return next;
    });
  }

  function moveSlotToReserve(squadIndex: number, playerIndex: number, targetReserveId?: string) {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const slot = next.squads[squadIndex]?.players[playerIndex];
      if (!slot?.id) return current;
      const reserveIds = next.reservePlayerIds || (next.reservePlayerIds = []);
      const insertIndex = targetReserveId ? reserveIds.indexOf(targetReserveId) : -1;
      if (insertIndex >= 0) {
        reserveIds.splice(insertIndex, 0, slot.id);
      } else {
        reserveIds.push(slot.id);
      }
      slot.id = undefined;
      slot.ack = false;
      return next;
    });
  }

  function moveSlotToNotAttending(squadIndex: number, playerIndex: number) {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const slot = next.squads[squadIndex]?.players[playerIndex];
      if (!slot?.id) return current;
      const notAttendingIds = next.notAttendingPlayerIds || (next.notAttendingPlayerIds = []);
      if (!notAttendingIds.includes(slot.id)) {
        notAttendingIds.push(slot.id);
      }
      slot.id = undefined;
      slot.ack = false;
      return next;
    });
  }

  function moveReserveToNotAttending(userId: string) {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.reservePlayerIds = (next.reservePlayerIds || []).filter((id) => id !== userId);
      const notAttendingIds = next.notAttendingPlayerIds || (next.notAttendingPlayerIds = []);
      if (!notAttendingIds.includes(userId)) {
        notAttendingIds.push(userId);
      }
      return next;
    });
  }

  function moveNotAttendingToReserve(userId: string, targetReserveId?: string) {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.notAttendingPlayerIds = (next.notAttendingPlayerIds || []).filter((id) => id !== userId);
      const reserveIds = next.reservePlayerIds || (next.reservePlayerIds = []);
      const insertIndex = targetReserveId ? reserveIds.indexOf(targetReserveId) : -1;
      if (insertIndex >= 0) {
        reserveIds.splice(insertIndex, 0, userId);
      } else {
        reserveIds.push(userId);
      }
      return next;
    });
  }

  function addPlayerToReserve(userId: string) {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const reserveIds = next.reservePlayerIds || (next.reservePlayerIds = []);
      if (!reserveIds.includes(userId)) {
        reserveIds.push(userId);
      }
      return next;
    });
  }

  function reorderReserves(sourceUserId: string, targetUserId: string) {
    setBoard((current) => {
      if (!current || sourceUserId === targetUserId) return current;
      const next = structuredClone(current);
      const sourceIndex = next.reservePlayerIds.indexOf(sourceUserId);
      const targetIndex = next.reservePlayerIds.indexOf(targetUserId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      next.reservePlayerIds.splice(sourceIndex, 1);
      next.reservePlayerIds.splice(targetIndex, 0, sourceUserId);
      return next;
    });
  }

  function swapSlots(sourceSquadIndex: number, sourcePlayerIndex: number, targetSquadIndex: number, targetPlayerIndex: number) {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const source = next.squads[sourceSquadIndex]?.players[sourcePlayerIndex];
      const target = next.squads[targetSquadIndex]?.players[targetPlayerIndex];
      if (!source || !target) return current;
      const sourceCopy = { ...source };
      next.squads[sourceSquadIndex].players[sourcePlayerIndex] = { ...target, roleName: source.roleName };
      next.squads[targetSquadIndex].players[targetPlayerIndex] = { ...sourceCopy, roleName: target.roleName };
      return next;
    });
  }

  function updatePlayerField(squadIndex: number, playerIndex: number, field: "note" | "roleName", value: string) {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const slot = next.squads[squadIndex]?.players[playerIndex];
      if (!slot) return current;
      slot[field] = value;
      return next;
    });
  }

  function moveSquad(index: number, direction: -1 | 1) {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.squads.length) return current;
      [next.squads[index], next.squads[targetIndex]] = [next.squads[targetIndex], next.squads[index]];
      next.squads = next.squads.map((squad, order) => ({ ...squad, order }));
      return next;
    });
  }

  function updateSquadField(squadIndex: number, field: "name" | "group" | "color", value: string) {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.squads[squadIndex] = { ...next.squads[squadIndex], [field]: value };
      return next;
    });
  }

  function addRosterSlot(squadIndex: number) {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.squads[squadIndex].players.push({ ack: false, roleName: dictionary.roster.newRoleName, note: "" });
      return next;
    });
  }

  function addRosterSquad() {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.squads.push({
        name: `${dictionary.roster.newSquadName} ${next.squads.length + 1}`,
        group: dictionary.roster.defaultSquadGroup,
        order: next.squads.length,
        color: "#64748b",
        players: [{ ack: false, roleName: dictionary.roster.defaultSquadLeadRole, note: "" }],
      });
      return next;
    });
  }

  function removeRosterSquad(squadIndex: number) {
    setBoard((current) => {
      if (!current || current.squads.length <= 1) return current;
      const next = structuredClone(current);
      const removedSquad = next.squads[squadIndex];
      for (const player of removedSquad.players) {
        if (player.id) next.reservePlayerIds.push(player.id);
      }
      next.squads.splice(squadIndex, 1);
      next.squads = next.squads.map((squad, order) => ({ ...squad, order }));
      return next;
    });
  }

  function removeRosterSlot(squadIndex: number, playerIndex: number) {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const player = next.squads[squadIndex].players[playerIndex];
      if (player?.id) next.reservePlayerIds.push(player.id);
      next.squads[squadIndex].players.splice(playerIndex, 1);
      return next;
    });
  }

  function handleDropOnSlot(squadIndex: number, playerIndex: number) {
    if (!dragState) return;
    if (dragState.type === "reserve") {
      moveReserveToSlot(dragState.userId, squadIndex, playerIndex);
    } else if (dragState.type === "notAttending") {
      moveNotAttendingToSlot(dragState.userId, squadIndex, playerIndex);
    } else {
      swapSlots(dragState.squadIndex, dragState.playerIndex, squadIndex, playerIndex);
    }
    setDragState(null);
  }

  function handleDropOnReserve(targetReserveId?: string) {
    if (!dragState) return;
    if (dragState.type === "reserve" && targetReserveId) {
      reorderReserves(dragState.userId, targetReserveId);
    }
    if (dragState.type === "slot") {
      moveSlotToReserve(dragState.squadIndex, dragState.playerIndex, targetReserveId);
    }
    if (dragState.type === "notAttending") {
      moveNotAttendingToReserve(dragState.userId, targetReserveId);
    }
    setDragState(null);
  }

  function handleDropOnNotAttending() {
    if (!dragState) return;
    if (dragState.type === "reserve") {
      moveReserveToNotAttending(dragState.userId);
    }
    if (dragState.type === "slot") {
      moveSlotToNotAttending(dragState.squadIndex, dragState.playerIndex);
    }
    setDragState(null);
  }

  const [userPickerOpen, setUserPickerOpen] = useState(false);

  function createSquadTopics() {
    if (!board) return;
    const squadTopics = board.squads.map((squad) => ({
      title: squad.name,
      body: `Topic for ${squad.name} (${squad.group})`,
      attachments: [],
    }));

    const generalTopic = {
      title: "General Discussion",
      body: "General coordination and discussion for the operation.",
      attachments: [],
    };

    const allTopics = [generalTopic, ...squadTopics];
    console.log("Generating topics:", allTopics);
    // In a real scenario, this would be saved to the database.
    // Given the current architecture, I will assume there's a way to save these topics
    // or they are part of the roster/event.
  }

  const handleSave = async (published: boolean = false) => {
    if (!board || !event) return;

    startTransition(async () => {
      try {
        const rosterId = await upsertRoster({
          rosterId: board.id === "draft-roster" ? undefined : (board.id as any),
          eventId: event.id as any,
          squadPresetId: board.squadPresetId as any,
          squads: board.squads.map(s => ({
            ...s,
            players: s.players.map(p => ({
              ...p,
              id: p.id || undefined,
            }))
          })),
          reservePlayerIds: board.reservePlayerIds || [],
          notAttendingPlayerIds: board.notAttendingPlayerIds || [],
          streamerId: board.streamerId,
          published: published,
        });

        const nextRosterId = String(rosterId);
        const wasDraft = board.id === "draft-roster";

        setBoard((prev) =>
          prev
            ? {
                ...prev,
                id: wasDraft ? nextRosterId : prev.id,
                published,
              }
            : prev,
        );

        if (wasDraft) {
          router.replace(`/${locale}/dashboard/servers/${serverId}/rosters/${nextRosterId}`);
        } else {
          router.refresh();
        }

        toast.success(published ? dictionary.roster.published : dictionary.roster.saved);
      } catch (error) {
        console.error("Failed to save roster:", error);
        toast.error(dictionary.common.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/60 bg-card text-card-foreground">
        <CardHeader className="flex flex-col gap-5 border-b border-border/70 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{dictionary.roster.title}</div>
            <CardTitle className="text-2xl">
              {event.name} - {formatDateTime(event.gameStart, timezone)}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {event.map} • {event.side} • {assignedCount}/{totalSlots} {dictionary.common.assigned}
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <Badge variant={board.published ? "default" : "secondary"} className="w-fit rounded-full px-3 py-1">
              {board.published ? dictionary.common.published : dictionary.common.unpublished}
            </Badge>
            {canAdmin ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => handleSave(board?.published)}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {dictionary.common.save}
                </Button>
                <Button variant={editMode ? "default" : "outline"} className="rounded-xl" onClick={() => setEditMode((value) => !value)}>
                  <Settings2 className="size-4" />
                  {editMode ? dictionary.roster.editingEnabled : dictionary.roster.editRoster}
                </Button>
                {!board?.published ? (
                  <Button
                    variant="default"
                    className="rounded-xl"
                    onClick={() => handleSave(true)}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    {dictionary.roster.publishRoster}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className=" flex flex-col gap-4">
          <div className="flex flex-row gap-2">
            <RosterInfoCard label={dictionary.roster.matchTime} value={formatDateTime(event.meetingStart, timezone)} />
            <RosterInfoCard label={dictionary.roster.opponent} value={event.name.split(dictionary.roster.versusDelimiter)[1]?.trim() ?? dictionary.common.unknown} />
            <RosterInfoCard label={dictionary.roster.mapSide} value={`${event.map ?? dictionary.common.unknown} • ${event.side ?? dictionary.common.unknown}`} />
            <RosterInfoCard label={dictionary.roster.notes} value={event.notes ?? dictionary.roster.noExtraNotes} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">

            <div className="space-y-8">
              {editMode ? (
                <div className="md:col-span-2">
                  <Button variant="outline" className="rounded-xl" onClick={addRosterSquad}>
                    <Plus className="size-4" />
                    {dictionary.roster.addSquad}
                  </Button>
                </div>
              ) : null}
              {squadGroups.map((groupEntry, groupIndex) => (
                <div key={`${groupEntry.group.name}-${groupIndex}`} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-6 w-1 rounded-full"
                      style={{ backgroundColor: groupEntry.group.color }}
                    />
                    {focusedGroup === groupEntry.group.name ? (
                      <CircleDot className="size-4 text-primary" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground/50" />
                    )}
                    <h3 className="text-lg font-bold uppercase tracking-wider">
                      {groupEntry.group.name}
                    </h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {groupEntry.squads.map((squad) => (
                      <SquadCard
                        key={`${squad.group}-${squad.name}`}
                        squad={squad}
                        squadIndex={board.squads.indexOf(squad)}
                        editMode={editMode}
                        dictionary={dictionary}
                        setFocusedGroup={setFocusedGroup}
                        updateSquadField={updateSquadField}
                        removeRosterSquad={removeRosterSquad}
                        moveSquad={moveSquad}
                        updatePlayerField={updatePlayerField}
                        removeRosterSlot={removeRosterSlot}
                        handleDropOnSlot={handleDropOnSlot}
                        addRosterSlot={addRosterSlot}
                        assignUserToSlot={assignUserToSlot}
                        allUsersSorted={allUsersSorted}
                        usersById={usersById}
                        assignmentsByUserId={assignmentsByUserId}
                        groupsById={groupsById}
                        canAdmin={canAdmin}
                        setDragState={setDragState}
                      />
                    ))}
                    {groupEntry.subgroups.length > 0 && (
                        groupEntry.subgroups.map((sub, subIndex) => (
                              sub.squads.map((squad) => (
                                <SquadCard
                                  key={`${squad.group}-${squad.name}`}
                                  squad={squad}
                                  squadIndex={board.squads.indexOf(squad)}
                                  editMode={editMode}
                                  dictionary={dictionary}
                                  setFocusedGroup={setFocusedGroup}
                                  updateSquadField={updateSquadField}
                                  removeRosterSquad={removeRosterSquad}
                                  moveSquad={moveSquad}
                                  updatePlayerField={updatePlayerField}
                                  removeRosterSlot={removeRosterSlot}
                                  handleDropOnSlot={handleDropOnSlot}
                                  addRosterSlot={addRosterSlot}
                                  assignUserToSlot={assignUserToSlot}
                                  allUsersSorted={allUsersSorted}
                                  usersById={usersById}
                                  assignmentsByUserId={assignmentsByUserId}
                                  groupsById={groupsById}
                                  canAdmin={canAdmin}
                                  setDragState={setDragState}
                                />
                              ))
                        ))
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-6">
              <Card className="rounded-2xl border-border/70 bg-card" onDragOver={(event) => editMode && event.preventDefault()} onDrop={() => handleDropOnReserve()}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{dictionary.common.reserves}</CardTitle>
                    {editMode && (
                      <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 rounded-xl">
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
                                      addPlayerToReserve(user.id);
                                      setUserPickerOpen(false);
                                    }}
                                  >
                                    <Avatar className="mr-2 size-6 rounded-sm">
                                      <AvatarImage src={user.avatar} />
                                      <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate">{user.name}</span>
                                    {board.reservePlayerIds?.includes(user.id) && (
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
                  {focusedGroup ? <div className="text-xs text-muted-foreground">{focusedGroup}</div> : null}
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={dictionary.common.searchReserves}
                    className="rounded-xl"
                  />
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {(() => {
                        const sections: Record<string, (AppUser & { _reserveSection?: string })[]> = {};
                        reserveUsers.forEach(u => {
                          const section = u._reserveSection || "Default";
                          if (!sections[section]) sections[section] = [];
                          sections[section].push(u);
                        });

                        const sectionOrder = Object.keys(sections).sort((a, b) => {
                          if (focusedGroup && a === focusedGroup) return -1;
                          if (focusedGroup && b === focusedGroup) return 1;
                          return a.localeCompare(b);
                        });

                        return sectionOrder.map(sectionName => {
                          const usersInSection = sections[sectionName];
                          if (!usersInSection?.length) return null;

                          return (
                            <div key={sectionName} className="space-y-2">
                              {focusedGroup && (
                                <div className="flex items-center gap-2 px-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                    {sectionName}
                                  </span>
                                  <div className="h-px flex-1 bg-border/40" />
                                </div>
                              )}
                              {usersInSection.map((user) => (
                                <div
                                  key={user.id}
                                  onDragOver={(event) => editMode && event.preventDefault()}
                                  onDrop={() => handleDropOnReserve(user.id)}
                                >
                                  {(() => {
                                    const assignment = assignmentsByUserId.get(user.id);
                                    return (
                                  <div
                                    draggable={editMode && canAdmin}
                                    onDragStart={() => setDragState({ type: "reserve", userId: user.id })}
                                    onDragEnd={() => setDragState(null)}
                                    className="flex min-w-0 cursor-grab items-start gap-3 rounded-xl border border-border/70 bg-background px-3 py-2"
                                  >
                                    {editMode && canAdmin ? <GripVertical className="size-4 text-muted-foreground" /> : null}
                                    <Avatar className="size-8 shrink-0 rounded-lg">
                                      <AvatarImage src={user.avatar} alt={user.name} />
                                      <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <div className="truncate text-sm font-medium">{user.name}</div>
                                        <GroupBadge assignment={assignment} groupsById={groupsById} dictionary={dictionary} />
                                      </div>
                                      <div className="break-words text-xs text-muted-foreground">{user.score} {dictionary.navUser.scoreSuffix}</div>
                                    </div>
                                  </div>
                                    );
                                  })()}
                                </div>
                              ))}
                            </div>
                          );
                        });
                      })()}
                      {!reserveUsers.length ? (
                        <div className="rounded-xl border border-dashed border-border/80 px-3 py-6 text-center text-sm text-muted-foreground">
                          {dictionary.userManagement.noResults}
                        </div>
                      ) : null}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/70 bg-card" onDragOver={(event) => editMode && event.preventDefault()} onDrop={() => handleDropOnNotAttending()}>
                <CardHeader>
                  <CardTitle className="text-base">{dictionary.roster.notAttending}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-4">
                      {(() => {
                        const sections: Record<string, (AppUser & { _reserveSection?: string })[]> = {};
                        groupedNotAttendingUsers.forEach((user) => {
                          const section = user._reserveSection || dictionary.shared.notSet;
                          if (!sections[section]) sections[section] = [];
                          sections[section].push(user);
                        });

                        return Object.keys(sections).sort((a, b) => a.localeCompare(b)).map((sectionName) => (
                          <div key={sectionName} className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                {sectionName}
                              </span>
                              <div className="h-px flex-1 bg-border/40" />
                            </div>
                            {sections[sectionName].map((user) => (
                              <div
                                key={user.id}
                                onDragOver={(event) => editMode && event.preventDefault()}
                                onDrop={() => handleDropOnNotAttending()}
                              >
                                {(() => {
                                  const assignment = assignmentsByUserId.get(user.id);
                                  return (
                                    <div
                                      draggable={editMode && canAdmin}
                                      onDragStart={() => setDragState({ type: "notAttending", userId: user.id })}
                                      onDragEnd={() => setDragState(null)}
                                      className="flex min-w-0 cursor-grab items-start gap-3 rounded-xl border border-border/70 bg-background px-3 py-2 opacity-60"
                                    >
                                      {editMode && canAdmin ? <GripVertical className="size-4 text-muted-foreground" /> : null}
                                      <Avatar className="size-8 shrink-0 rounded-lg">
                                        <AvatarImage src={user.avatar} alt={user.name} />
                                        <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <div className="truncate text-sm font-medium">{user.name}</div>
                                          <GroupBadge assignment={assignment} groupsById={groupsById} dictionary={dictionary} />
                                        </div>
                                        <div className="break-words text-xs text-muted-foreground">{user.score} {dictionary.navUser.scoreSuffix}</div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                        ));
                      })()}
                      {!groupedNotAttendingUsers.length ? (
                        <div className="rounded-xl border border-dashed border-border/80 px-3 py-6 text-center text-sm text-muted-foreground">
                          {dictionary.shared.nothingCreatedYet}
                        </div>
                      ) : null}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SquadCard({
  squad,
  squadIndex,
  editMode,
  dictionary,
  setFocusedGroup,
  updateSquadField,
  removeRosterSquad,
  moveSquad,
  updatePlayerField,
  removeRosterSlot,
  handleDropOnSlot,
  addRosterSlot,
  assignUserToSlot,
  allUsersSorted,
  usersById,
  assignmentsByUserId,
  groupsById,
  canAdmin,
  setDragState,
}: {
  squad: Roster["squads"][0];
  squadIndex: number;
  editMode: boolean;
  dictionary: Dictionary;
  setFocusedGroup: (group: string) => void;
  updateSquadField: (index: number, field: "name" | "group" | "color", value: string) => void;
  removeRosterSquad: (index: number) => void;
  moveSquad: (index: number, direction: -1 | 1) => void;
  updatePlayerField: (sIndex: number, pIndex: number, field: "note" | "roleName", value: string) => void;
  removeRosterSlot: (sIndex: number, pIndex: number) => void;
  handleDropOnSlot: (sIndex: number, pIndex: number) => void;
  addRosterSlot: (index: number) => void;
  assignUserToSlot: (userId: string, sIndex: number, pIndex: number) => void;
  allUsersSorted: AppUser[];
  usersById: Map<string, AppUser>;
  assignmentsByUserId: Map<string, ServerUserAssignment>;
  groupsById: Map<string, Group>;
  canAdmin: boolean;
  setDragState: (state: DragState | null) => void;
}) {
  const [slotPickerOpen, setSlotPickerOpen] = useState<number | null>(null);
  const [slotSearches, setSlotSearches] = useState<Record<number, string>>({});

  return (
    <Card
      className="rounded-2xl border-border/70 bg-card"
      style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${squad.color} 60%, transparent)` }}
      onClick={() => setFocusedGroup(squad.group)}
    >
      <CardHeader className="">
        {editMode ? (
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
              <CardTitle className="cursor-pointer text-lg" onClick={() => setFocusedGroup(squad.group)}>{squad.name}</CardTitle>
              <div className="cursor-pointer text-xs uppercase tracking-[0.2em] text-muted-foreground" onClick={() => setFocusedGroup(squad.group)}>{squad.group}</div>
            </div>
            <Badge className="rounded-full border-0" style={{ backgroundColor: squad.color, color: "#08111f" }}>
              {squad.players.length} slots
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {squad.players.map((player, playerIndex) => {
          const slotUser = player.id ? usersById.get(player.id) : undefined;
          const assignment = slotUser ? assignmentsByUserId.get(slotUser.id) : undefined;

          return (
            <div
              key={`${squadIndex}-${playerIndex}`}
              onDragOver={(event) => {
                if (editMode) event.preventDefault();
              }}
              onDrop={() => handleDropOnSlot(squadIndex, playerIndex)}
              className="rounded-xl border border-border/70 bg-muted/20 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                {editMode ? (
                  <Input defaultValue={player.roleName ?? ""} onBlur={(event) => updatePlayerField(squadIndex, playerIndex, "roleName", event.target.value)} className="h-8 rounded-lg text-xs" />
                ) : (
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{player.roleName ?? dictionary.roster.role}</div>
                )}
                {editMode ? (
                  <Button variant="ghost" size="icon" className="size-8 rounded-xl" onClick={() => removeRosterSlot(squadIndex, playerIndex)}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              {slotUser ? (
                <div className="space-y-2">
                  <div
                    draggable={editMode && canAdmin}
                    onDragStart={() => setDragState({ type: "slot", squadIndex, playerIndex })}
                    onDragEnd={() => setDragState(null)}
                    className="flex min-w-0 cursor-grab items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2"
                  >
                    {editMode && canAdmin ? <GripVertical className="size-4 text-muted-foreground" /> : null}
                    <Avatar className="size-8 shrink-0 rounded-lg">
                      <AvatarImage src={slotUser.avatar} alt={slotUser.name} />
                      <AvatarFallback>{slotUser.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-medium">{slotUser.name}</div>
                        <GroupBadge assignment={assignment} groupsById={groupsById} dictionary={dictionary} />
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{player.note ?? ""}</div>
                    </div>
                    {player.ack ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Radio className="size-4 text-amber-500" />}
                  </div>
                  {editMode ? (
                    <Input defaultValue={player.note ?? ""} onBlur={(event) => updatePlayerField(squadIndex, playerIndex, "note", event.target.value)} placeholder={dictionary.common.playerNote} className="rounded-lg" />
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <Popover open={slotPickerOpen === playerIndex} onOpenChange={(open) => setSlotPickerOpen(open ? playerIndex : null)}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full rounded-xl border border-dashed border-border/80 px-3 py-4 text-left text-sm text-muted-foreground"
                      >
                        {player.note ?? dictionary.common.openSlot}
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
                          <CommandGroup>
                            {allUsersSorted
                              .filter((user) => user.name.toLowerCase().includes((slotSearches[playerIndex] ?? "").trim().toLowerCase()))
                              .slice(0, 5)
                              .map((user) => {
                                const assignment = assignmentsByUserId.get(user.id);
                                const assignedElsewhere = squad.players.some((currentPlayer, currentIndex) => currentIndex !== playerIndex && currentPlayer.id === user.id);

                                return (
                                  <CommandItem
                                    key={user.id}
                                    value={user.name}
                                    onSelect={() => {
                                      assignUserToSlot(user.id, squadIndex, playerIndex);
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
                                        {getPrimaryGroupLabel(assignment, groupsById, dictionary)} • {user.score} {dictionary.navUser.scoreSuffix}
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
                  {editMode ? (
                    <Input defaultValue={player.note ?? ""} onBlur={(event) => updatePlayerField(squadIndex, playerIndex, "note", event.target.value)} placeholder={dictionary.common.slotNote} className="rounded-lg" />
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
        {editMode ? (
          <Button variant="outline" className="w-full rounded-xl" onClick={() => addRosterSlot(squadIndex)}>
            <Plus className="size-4" />
            {dictionary.roster.addSlot}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RosterInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}

function getGroupMatchRank(
  assignment: ServerUserAssignment | undefined,
  focusedGroup: string | null,
  groupsById: Map<string, Group>,
) {
  if (!focusedGroup) return 0;
  const primaryGroupName = assignment?.primaryGroupId ? groupsById.get(assignment.primaryGroupId)?.name : undefined;
  if (primaryGroupName === focusedGroup) return 0;
  const secondaryGroupNames = (assignment?.secondaryGroupIds || []).map((groupId) => groupsById.get(groupId as never)?.name).filter(Boolean) as string[];
  if (secondaryGroupNames.includes(focusedGroup)) return 1;
  return 2;
}

function getPrimaryGroupLabel(
  assignment: ServerUserAssignment | undefined,
  groupsById: Map<string, Group>,
  dictionary: Dictionary,
) {
  const primaryGroup = assignment?.primaryGroupId ? groupsById.get(assignment.primaryGroupId) : undefined;
  return primaryGroup?.name ?? dictionary.shared.notSet;
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
