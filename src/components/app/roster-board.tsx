"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  Circle,
  CircleDot,
  Loader2,
  Plus,
  Save,
  Send,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RosterBoardAttendeeLists } from "@/components/app/roster-board-attendee-lists";
import { SquadCard } from "@/components/app/roster-board-squad-card";
import type { AttendanceStatus, DragState, RosterBoardMode } from "@/components/app/roster-board-types";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ServerUserAssignment } from "@/lib/server-user-management";
import type { AppUser, EventRecord, Group, Roster } from "@/types/domain";
import { formatDateTime } from "@/lib/format";
import { formatHllPresetLabel } from "@/lib/hll-map-presets";
import { getUserScoreForGuild } from "@/lib/user-scores";

function getCustomPlayerName(player: Roster["squads"][number]["players"][number]) {
  return player.customName?.trim() || undefined;
}

function isRosterSlotFilled(player: Roster["squads"][number]["players"][number]) {
  return Boolean(player.id || getCustomPlayerName(player));
}

function clearRosterPlayerAssignment(player: Roster["squads"][number]["players"][number]) {
  player.id = undefined;
  player.customName = undefined;
  player.ack = false;
  player.confirmed = false;
}

function compareUsersByScoreThenName(a: AppUser, b: AppUser, serverDiscordId: string) {
  return (getUserScoreForGuild(b, serverDiscordId) - getUserScoreForGuild(a, serverDiscordId)) || a.name.localeCompare(b.name);
}

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
  meetingChannelId,
  defaultMode = "view",
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
  meetingChannelId?: string;
  defaultMode?: RosterBoardMode;
}) {
  const router = useRouter();
  const [board, setBoard] = useState(roster);
  const [mode, setMode] = useState<RosterBoardMode>(defaultMode);
  const [reserveSearch, setReserveSearch] = useState("");
  const [notAttendingSearch, setNotAttendingSearch] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [focusedGroup, setFocusedGroup] = useState<string | null>(null);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [notAttendingPickerOpen, setNotAttendingPickerOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const deferredReserveSearch = useDeferredValue(reserveSearch);
  const deferredNotAttendingSearch = useDeferredValue(notAttendingSearch);
  const isLayoutMode = mode === "layout";
  const isAssignmentMode = mode === "assignment";
  const formattedMap = formatHllPresetLabel(event?.map) ?? event?.map ?? dictionary.common.unknown;

  useEffect(() => {
    setBoard(roster);
    setIsDirty(false);
  }, [roster]);

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  const [isPending, startTransition] = useTransition();
  const [isConfirmingMeetingChannel, setIsConfirmingMeetingChannel] = useState(false);
  const upsertRoster = useMutation(api.rosters.upsert);

  const usersById = useMemo(() => new Map(users.map((user) => [user.discordId, user])), [users]);
  const assignmentsByUserId = useMemo(() => new Map(userAssignments.map((assignment) => [assignment.userId, assignment])), [userAssignments]);
  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const noticeReasonByUserId = useMemo(
    () => new Map((event?.absenceNotices ?? []).map((notice) => [notice.userId, notice.reason])),
    [event?.absenceNotices],
  );
  const allUsersSorted = useMemo(
    () => users.slice().sort((a, b) => compareUsersByScoreThenName(a, b, event?.guildId ?? serverId)),
    [event?.guildId, serverId, users],
  );
  const normalizedReserveSearch = deferredReserveSearch.trim().toLowerCase();
  const normalizedNotAttendingSearch = deferredNotAttendingSearch.trim().toLowerCase();
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
    () => board?.squads.reduce((sum, squad) => sum + squad.players.filter((player) => isRosterSlotFilled(player)).length, 0) ?? 0,
    [board],
  );

  const totalSlots = useMemo(
    () => board?.squads.reduce((sum, squad) => sum + squad.players.length, 0) ?? 0,
    [board],
  );

  const assignedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    board?.squads.forEach((squad) => {
      squad.players.forEach((player) => {
        if (player.id && isRosterSlotFilled(player)) {
          ids.add(player.id);
        }
      });
    });
    return ids;
  }, [board]);

  const reserveUsers = useMemo(() => {
    if (!board) return [];
    const notAttendingIds = new Set(board.notAttendingPlayerIds || []);

    const filtered = (board.reservePlayerIds || [])
      .filter((id) => !notAttendingIds.has(id))
      .filter((id) => !assignedPlayerIds.has(id))
      .map((id) => usersById.get(id))
      .filter((user): user is AppUser => Boolean(user))
      .filter((user) => user.name.toLowerCase().includes(normalizedReserveSearch));

    return filtered
      .sort((a, b) => compareUsersByScoreThenName(a, b, event?.guildId ?? serverId))
      .map((user) => ({
        ...user,
        _reserveSection: getPrimaryGroupLabel(assignmentsByUserId.get(user.discordId), groupsById, dictionary),
      }));
  }, [assignedPlayerIds, assignmentsByUserId, board, dictionary, groupsById, normalizedReserveSearch, usersById]);

  const notAttendingUsers = useMemo(() => {
    if (!board) return [];
    return (board.notAttendingPlayerIds || [])
      .filter((id) => !assignedPlayerIds.has(id))
      .map((id) => usersById.get(id))
      .filter((user): user is AppUser => Boolean(user))
      .filter((user) => user.name.toLowerCase().includes(normalizedNotAttendingSearch))
      .sort((a, b) => compareUsersByScoreThenName(a, b, event?.guildId ?? serverId));
  }, [assignedPlayerIds, board, normalizedNotAttendingSearch, usersById]);

  const groupedNotAttendingUsers = useMemo(
    () => notAttendingUsers.map((user) => ({
      ...user,
      _reserveSection: getPrimaryGroupLabel(assignmentsByUserId.get(user.discordId), groupsById, dictionary),
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
    setIsDirty(true);
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
            clearRosterPlayerAssignment(player);
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
      slot.customName = undefined;
      slot.ack = false;
      slot.confirmed = false;
      return next;
    });
  }

  function assignPlaceholderToSlot(customName: string, squadIndex: number, playerIndex: number) {
    const trimmedName = customName.trim();
    if (!trimmedName) {
      return;
    }

    setIsDirty(true);
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const slot = next.squads[squadIndex]?.players[playerIndex];
      if (!slot) return current;

      if (slot.id && slot.id !== trimmedName) {
        const reserveIds = next.reservePlayerIds || (next.reservePlayerIds = []);
        if (!reserveIds.includes(slot.id)) {
          reserveIds.push(slot.id);
        }
      }

      clearRosterPlayerAssignment(slot);
      slot.customName = trimmedName;
      return next;
    });
  }

  function moveSlotToReserve(squadIndex: number, playerIndex: number, targetReserveId?: string) {
    setIsDirty(true);
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
      clearRosterPlayerAssignment(slot);
      return next;
    });
  }

  function moveSlotToNotAttending(squadIndex: number, playerIndex: number) {
    setIsDirty(true);
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const slot = next.squads[squadIndex]?.players[playerIndex];
      if (!slot?.id) return current;
      const notAttendingIds = next.notAttendingPlayerIds || (next.notAttendingPlayerIds = []);
      if (!notAttendingIds.includes(slot.id)) {
        notAttendingIds.push(slot.id);
      }
      clearRosterPlayerAssignment(slot);
      return next;
    });
  }

  function moveReserveToNotAttending(userId: string) {
    setIsDirty(true);
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
    setIsDirty(true);
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
    setIsDirty(true);
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.notAttendingPlayerIds = (next.notAttendingPlayerIds || []).filter((id) => id !== userId);
      next.squads.forEach((squad) => {
        squad.players.forEach((player) => {
          if (player.id === userId) {
            clearRosterPlayerAssignment(player);
          }
        });
      });
      const reserveIds = next.reservePlayerIds || (next.reservePlayerIds = []);
      if (!reserveIds.includes(userId)) {
        reserveIds.push(userId);
      }
      return next;
    });
  }

  function addPlayerToNotAttending(userId: string) {
    setIsDirty(true);
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.reservePlayerIds = (next.reservePlayerIds || []).filter((id) => id !== userId);
      next.squads.forEach((squad) => {
        squad.players.forEach((player) => {
          if (player.id === userId) {
            clearRosterPlayerAssignment(player);
          }
        });
      });
      const notAttendingIds = next.notAttendingPlayerIds || (next.notAttendingPlayerIds = []);
      if (!notAttendingIds.includes(userId)) {
        notAttendingIds.push(userId);
      }
      return next;
    });
  }

  function reorderReserves(sourceUserId: string, targetUserId: string) {
    setIsDirty(true);
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
    setIsDirty(true);
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const source = next.squads[sourceSquadIndex]?.players[sourcePlayerIndex];
      const target = next.squads[targetSquadIndex]?.players[targetPlayerIndex];
      if (!source || !target) return current;
      const sourceCopy = { ...source };
      next.squads[sourceSquadIndex].players[sourcePlayerIndex] = {
        ...target,
        roleName: source.roleName,
        roleIcon: source.roleIcon,
      };
      next.squads[targetSquadIndex].players[targetPlayerIndex] = {
        ...sourceCopy,
        roleName: target.roleName,
        roleIcon: target.roleIcon,
      };
      return next;
    });
  }

  function updatePlayerField(squadIndex: number, playerIndex: number, field: "note" | "roleName", value: string) {
    setIsDirty(true);
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const slot = next.squads[squadIndex]?.players[playerIndex];
      if (!slot) return current;
      slot[field] = value;
      return next;
    });
  }

  function updatePlayerIcon(squadIndex: number, playerIndex: number, roleIcon: string) {
    setIsDirty(true);
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const slot = next.squads[squadIndex]?.players[playerIndex];
      if (!slot) return current;
      slot.roleIcon = roleIcon;
      return next;
    });
  }

  function updatePlayerAttendanceStatus(squadIndex: number, playerIndex: number, status: AttendanceStatus) {
    setIsDirty(true);
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const slot = next.squads[squadIndex]?.players[playerIndex];
      if (!slot || !slot.id) return current;
      slot.ack = status !== "pending";
      slot.confirmed = status === "confirmed";
      return next;
    });
  }

  function clearSlotAssignment(squadIndex: number, playerIndex: number) {
    setIsDirty(true);
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const slot = next.squads[squadIndex]?.players[playerIndex];
      if (!slot || (!slot.id && !getCustomPlayerName(slot))) return current;

      if (slot.id) {
        const reserveIds = next.reservePlayerIds || (next.reservePlayerIds = []);
        if (!reserveIds.includes(slot.id)) {
          reserveIds.push(slot.id);
        }
      }

      clearRosterPlayerAssignment(slot);
      return next;
    });
  }

  function moveSquad(index: number, direction: -1 | 1) {
    setIsDirty(true);
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
    setIsDirty(true);
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.squads[squadIndex] = { ...next.squads[squadIndex], [field]: value };
      return next;
    });
  }

  function addRosterSlot(squadIndex: number) {
    setIsDirty(true);
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.squads[squadIndex].players.push({
        ack: false,
        confirmed: false,
        roleName: dictionary.roster.newRoleName,
        roleIcon: "/img/roles/icn_Rifleman.png",
        note: "",
      });
      return next;
    });
  }

  function addRosterSquad() {
    setIsDirty(true);
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.squads.push({
        name: `${dictionary.roster.newSquadName} ${next.squads.length + 1}`,
        group: dictionary.roster.defaultSquadGroup,
        order: next.squads.length,
        color: "#64748b",
        players: [{ ack: false, confirmed: false, roleName: dictionary.roster.defaultSquadLeadRole, note: "", roleIcon: "/img/roles/icn_officer.png" }],
      });
      return next;
    });
  }

  function removeRosterSquad(squadIndex: number) {
    setIsDirty(true);
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
    setIsDirty(true);
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

  const handleSave = async (published: boolean = false) => {
    if (!board || !event) return;

    startTransition(async () => {
      try {
        const saveSquads = board.squads.map(s => ({
          ...s,
          players: s.players.map(p => ({
            ...p,
            id: p.id || undefined,
            customName: p.customName?.trim() || undefined,
          }))
        }));
        const savedAssignedPlayerIds = new Set<string>();
        saveSquads.forEach((squad) => {
          squad.players.forEach((player) => {
            if (player.id && isRosterSlotFilled(player)) {
              savedAssignedPlayerIds.add(player.id);
            }
          });
        });
        const cleanNotAttendingPlayerIds = Array.from(new Set(board.notAttendingPlayerIds || []))
          .filter((id) => !savedAssignedPlayerIds.has(id));
        const cleanNotAttendingSet = new Set(cleanNotAttendingPlayerIds);
        const cleanReservePlayerIds = Array.from(new Set(board.reservePlayerIds || []))
          .filter((id) => !savedAssignedPlayerIds.has(id) && !cleanNotAttendingSet.has(id));

        const rosterId = await upsertRoster({
          rosterId: board.id === "draft-roster" ? undefined : (board.id as Id<"rosters">),
          eventId: event.id as Id<"events">,
          squadPresetId: board.squadPresetId as Id<"squadPresets">,
          squads: saveSquads,
          reservePlayerIds: cleanReservePlayerIds,
          notAttendingPlayerIds: cleanNotAttendingPlayerIds,
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
                reservePlayerIds: cleanReservePlayerIds,
                notAttendingPlayerIds: cleanNotAttendingPlayerIds,
                published,
              }
            : prev,
        );
        setIsDirty(false);
        setPublishDialogOpen(false);

        if (wasDraft) {
          router.replace(`/${locale}/dashboard/servers/${serverId}/rosters/${nextRosterId}`);
        } else {
          router.refresh();
        }

        await fetch("/api/cache/roster-image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            eventId: event.id,
          }),
        }).catch(() => null);

        toast.success(published ? dictionary.roster.published : dictionary.roster.saved);
      } catch (error) {
        console.error("Failed to save roster:", error);
        toast.error(dictionary.common.error);
      }
    });
  };

  const canConfirmFromMeetingChannel = Boolean(meetingChannelId && board?.id && event?.id);
  const shouldShowMeetingChannelConfirmation = canAdmin && mode === "view";
  const actionControlClass = "h-10 min-h-10 w-full shrink-0 rounded-xl px-4 text-xs sm:w-56";
  const actionSelectTriggerClass = `${actionControlClass} data-[size=default]:h-10`;
  const confirmFromMeetingChannelButton = (
    <Button
      variant="outline"
      className={actionControlClass}
      onClick={handleConfirmFromMeetingChannel}
      disabled={!canConfirmFromMeetingChannel || isPending || isConfirmingMeetingChannel}
    >
      {isConfirmingMeetingChannel ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      {isConfirmingMeetingChannel
        ? dictionary.roster.confirmingFromMeetingChannel
        : dictionary.roster.confirmFromMeetingChannel}
    </Button>
  );

  async function handleConfirmFromMeetingChannel() {
    if (!board?.id || !event || !canConfirmFromMeetingChannel) {
      return;
    }

    setIsConfirmingMeetingChannel(true);

    try {
      const response = await fetch(`/api/servers/${serverId}/rosters/${board.id}/confirm-meeting-attendance`, {
        method: "POST",
      });
      const body = await response.json();

      if (!response.ok) {
        toast.error(body.error ?? dictionary.common.error);
        return;
      }

      if (body.updatedCount > 0) {
        setBoard((current) => {
          if (!current) return current;

          const next = structuredClone(current);
          const confirmedUserIds = new Set<string>(body.updatedUserIds);

          next.squads = next.squads.map((squad) => ({
            ...squad,
            players: squad.players.map((player) => {
              if (!player.id || !confirmedUserIds.has(player.id)) {
                return player;
              }

              return {
                ...player,
                ack: true,
                confirmed: true,
              };
            }),
          }));

          return next;
        });
      }

      router.refresh();

      toast.success(
        body.updatedCount > 0
          ? dictionary.roster.confirmedFromMeetingChannel.replace("{count}", String(body.updatedCount))
          : dictionary.roster.noRosterPlayersInMeetingChannel,
      );
    } catch (error) {
      console.error("Failed to confirm roster from meeting channel:", error);
      toast.error(dictionary.common.error);
    } finally {
      setIsConfirmingMeetingChannel(false);
    }
  }


  return (
    <div className="space-y-2">
      {canAdmin ? (
        <div className="flex justify-center md:justify-end">
          <div className="flex w-full flex-wrap justify-center gap-3 md:w-auto md:justify-end">
            <Select value={mode} onValueChange={(value) => setMode(value as RosterBoardMode)}>
              <SelectTrigger className={actionSelectTriggerClass}>
                <Settings2 className="size-4" />
                <SelectValue placeholder={dictionary.roster.modeView} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">{dictionary.roster.modeView}</SelectItem>
                <SelectItem value="layout">{dictionary.roster.modeLayout}</SelectItem>
                <SelectItem value="assignment">{dictionary.roster.modeAssignment}</SelectItem>
              </SelectContent>
            </Select>
            {shouldShowMeetingChannelConfirmation ? (
              canConfirmFromMeetingChannel ? (
                confirmFromMeetingChannelButton
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="block">
                      {confirmFromMeetingChannelButton}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {dictionary.roster.confirmFromMeetingChannelHelp}
                  </TooltipContent>
                </Tooltip>
              )
            ) : null}
            <Button
              variant="outline"
              className={actionControlClass}
              onClick={() => handleSave(board?.published)}
              disabled={!isDirty || isPending || isConfirmingMeetingChannel}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {dictionary.common.save}
            </Button>
            {!board?.published ? (
              <Button
                variant="default"
                className={actionControlClass}
                onClick={() => setPublishDialogOpen(true)}
                disabled={isPending || isConfirmingMeetingChannel}
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {dictionary.roster.publishRoster}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <Card className="rounded-2xl border-border/60 bg-card text-card-foreground">
        <CardHeader className="flex flex-col gap-5 border-b border-border/70 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1.5">
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{dictionary.roster.title}</div>
              <CardTitle className="text-xl leading-none">
                {event.name} - {formatDateTime(event.gameStart, timezone)}
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                {formattedMap} • {event.side} • {assignedCount}/{totalSlots} {dictionary.common.assigned}
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <Badge variant={board.published ? "default" : "secondary"} className="w-fit rounded-full px-3 py-1">
                {board.published ? dictionary.common.published : dictionary.common.unpublished}
              </Badge>
            </div>
          </div>

        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <RosterInfoCard label={dictionary.roster.matchTime} value={formatDateTime(event.meetingStart, timezone)} />
            <RosterInfoCard label={dictionary.roster.opponent} value={event.name.split(dictionary.roster.versusDelimiter)[1]?.trim() ?? dictionary.common.unknown} />
            <RosterInfoCard label={dictionary.roster.mapSide} value={`${formattedMap} • ${event.side ?? dictionary.common.unknown}`} />
            <RosterInfoCard label={dictionary.roster.notes} value={event.notes ?? dictionary.roster.noExtraNotes} />
          </div>
          <div className="flex flex-col gap-4">
            <RosterBoardAttendeeLists
              board={board}
              users={users}
              reserveUsers={reserveUsers}
              groupedNotAttendingUsers={groupedNotAttendingUsers}
              assignmentsByUserId={assignmentsByUserId}
              groupsById={groupsById}
              dictionary={dictionary}
              reserveSearch={reserveSearch}
              setReserveSearch={setReserveSearch}
              notAttendingSearch={notAttendingSearch}
              setNotAttendingSearch={setNotAttendingSearch}
              focusedGroup={focusedGroup}
              isAssignmentMode={isAssignmentMode}
              canAdmin={canAdmin}
              userPickerOpen={userPickerOpen}
              setUserPickerOpen={setUserPickerOpen}
              notAttendingPickerOpen={notAttendingPickerOpen}
              setNotAttendingPickerOpen={setNotAttendingPickerOpen}
              addPlayerToReserve={addPlayerToReserve}
              addPlayerToNotAttending={addPlayerToNotAttending}
              handleDropOnReserve={handleDropOnReserve}
              handleDropOnNotAttending={handleDropOnNotAttending}
              setDragState={setDragState}
              serverDiscordId={event.guildId}
              noticeReasonByUserId={noticeReasonByUserId}
            />
            <div className="space-y-2.5">
              {isLayoutMode ? (
                <div className="md:col-span-2">
                  <Button variant="outline" className="h-9 rounded-xl" onClick={addRosterSquad}>
                    <Plus className="size-4" />
                    {dictionary.roster.addSquad}
                  </Button>
                </div>
              ) : null}
              {squadGroups.map((groupEntry, groupIndex) => (
                <div key={`${groupEntry.group.name}-${groupIndex}`} className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-4 w-1 rounded-full"
                      style={{ backgroundColor: groupEntry.group.color }}
                    />
                    {focusedGroup === groupEntry.group.name ? (
                      <CircleDot className="size-3.5 text-primary" />
                    ) : (
                      <Circle className="size-3.5 text-muted-foreground/50" />
                    )}
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em]">
                      {groupEntry.group.name}
                    </h3>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {groupEntry.squads.map((squad) => (
                      <SquadCard
                        key={`${squad.group}-${squad.name}`}
                        squad={squad}
                        board={board}
                        squadIndex={board.squads.indexOf(squad)}
                        mode={mode}
                        dictionary={dictionary}
                        setFocusedGroup={setFocusedGroup}
                        updateSquadField={updateSquadField}
                        removeRosterSquad={removeRosterSquad}
                        moveSquad={moveSquad}
                        updatePlayerField={updatePlayerField}
                        updatePlayerIcon={updatePlayerIcon}
                        updatePlayerAttendanceStatus={updatePlayerAttendanceStatus}
                        removeRosterSlot={removeRosterSlot}
                        moveSlotToReserve={moveSlotToReserve}
                        moveSlotToNotAttending={moveSlotToNotAttending}
                        clearSlotAssignment={clearSlotAssignment}
                        handleDropOnSlot={handleDropOnSlot}
                        addRosterSlot={addRosterSlot}
                        assignUserToSlot={assignUserToSlot}
                        assignPlaceholderToSlot={assignPlaceholderToSlot}
                        allUsersSorted={allUsersSorted}
                        usersById={usersById}
                        assignmentsByUserId={assignmentsByUserId}
                        groupsById={groupsById}
                        canAdmin={canAdmin}
                        setDragState={setDragState}
                        serverDiscordId={event.guildId}
                        noticeReasonByUserId={noticeReasonByUserId}
                      />
                    ))}
                    {groupEntry.subgroups.length > 0 && (
                        groupEntry.subgroups.map((sub) => (
                              sub.squads.map((squad) => (
                                <SquadCard
                                  key={`${squad.group}-${squad.name}`}
                                  squad={squad}
                                  board={board}
                                  squadIndex={board.squads.indexOf(squad)}
                                  mode={mode}
                                  dictionary={dictionary}
                                  setFocusedGroup={setFocusedGroup}
                                  updateSquadField={updateSquadField}
                                  removeRosterSquad={removeRosterSquad}
                                  moveSquad={moveSquad}
                                  updatePlayerField={updatePlayerField}
                                   updatePlayerIcon={updatePlayerIcon}
                                   updatePlayerAttendanceStatus={updatePlayerAttendanceStatus}
                                   removeRosterSlot={removeRosterSlot}
                                   moveSlotToReserve={moveSlotToReserve}
                                   moveSlotToNotAttending={moveSlotToNotAttending}
                                   clearSlotAssignment={clearSlotAssignment}
                                   handleDropOnSlot={handleDropOnSlot}
                                   addRosterSlot={addRosterSlot}
                                   assignUserToSlot={assignUserToSlot}
                                   assignPlaceholderToSlot={assignPlaceholderToSlot}
                                  allUsersSorted={allUsersSorted}
                                  usersById={usersById}
                                  assignmentsByUserId={assignmentsByUserId}
                                  groupsById={groupsById}
                                  canAdmin={canAdmin}
                                  setDragState={setDragState}
                                  serverDiscordId={event.guildId}
                                  noticeReasonByUserId={noticeReasonByUserId}
                                />
                              ))
                        ))
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </CardContent>
      </Card>
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dictionary.roster.publishConfirmTitle}</DialogTitle>
            <DialogDescription>{dictionary.roster.publishConfirmDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">
                {dictionary.common.cancel}
              </Button>
            </DialogClose>
            <Button className="rounded-xl" onClick={() => handleSave(true)} disabled={isPending || isConfirmingMeetingChannel}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {dictionary.roster.publishRoster}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RosterInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 line-clamp-2 text-xs font-medium">{value}</div>
    </div>
  );
}

function getPrimaryGroupLabel(
  assignment: ServerUserAssignment | undefined,
  groupsById: Map<string, Group>,
  dictionary: Dictionary,
) {
  const primaryGroup = assignment?.primaryGroupId ? groupsById.get(assignment.primaryGroupId) : undefined;
  return primaryGroup?.name ?? dictionary.shared.notSet;
}
