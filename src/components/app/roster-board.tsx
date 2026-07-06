"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, GripVertical, Plus, Radio, Send, Settings2, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Dictionary } from "@/i18n/dictionaries";
import type { AppUser, EventRecord, Roster } from "@/types/domain";
import { formatDateTime } from "@/lib/format";

type DragState =
  | { type: "reserve"; userId: string }
  | { type: "slot"; squadIndex: number; playerIndex: number };

export function RosterBoard({
  roster,
  event,
  users,
  canAdmin,
  dictionary,
}: {
  roster?: Roster;
  event?: EventRecord;
  users: AppUser[];
  canAdmin: boolean;
  dictionary: Dictionary;
}) {
  const [board, setBoard] = useState(roster);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);

  const reserveUsers = useMemo(() => {
    if (!board) return [];
    return board.reservePlayerIds
      .map((id) => users.find((user) => user.id === id))
      .filter((user): user is AppUser => Boolean(user))
      .filter((user) => user.name.toLowerCase().includes(search.toLowerCase()));
  }, [board, search, users]);

  if (!event) {
    return (
      <Card className="rounded-2xl border-dashed border-border/80">
        <CardContent className="py-16 text-center text-muted-foreground">
          Roster has not been assigned to an event yet.
        </CardContent>
      </Card>
    );
  }

  if (!board) {
    return (
      <Card className="rounded-2xl border-dashed border-border/80">
        <CardContent className="py-16 text-center text-muted-foreground">
          Roster has not been created yet.
        </CardContent>
      </Card>
    );
  }

  if (!board.published && !canAdmin) {
    return (
      <Card className="rounded-2xl border-dashed border-border/80">
        <CardContent className="py-16 text-center text-muted-foreground">
          Roster not yet available.
        </CardContent>
      </Card>
    );
  }

  function moveReserveToSlot(reserveUserId: string, squadIndex: number, playerIndex: number) {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.reservePlayerIds = next.reservePlayerIds.filter((id) => id !== reserveUserId);
      const slot = next.squads[squadIndex]?.players[playerIndex];
      if (!slot) return current;
      if (slot.id) next.reservePlayerIds.push(slot.id);
      slot.id = reserveUserId;
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
      const insertIndex = targetReserveId ? next.reservePlayerIds.indexOf(targetReserveId) : -1;
      if (insertIndex >= 0) {
        next.reservePlayerIds.splice(insertIndex, 0, slot.id);
      } else {
        next.reservePlayerIds.push(slot.id);
      }
      slot.id = undefined;
      slot.ack = false;
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
      next.squads[squadIndex].players.push({ ack: false, roleName: "New role", note: "" });
      return next;
    });
  }

  function addRosterSquad() {
    setBoard((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      next.squads.push({
        name: `Squad ${next.squads.length + 1}`,
        group: "Infantry Squad",
        order: next.squads.length,
        color: "#64748b",
        players: [{ ack: false, roleName: "Squad Lead", note: "" }],
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
    setDragState(null);
  }

  const assignedCount = board.squads.reduce((sum, squad) => sum + squad.players.filter((player) => player.id).length, 0);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/60 bg-card text-card-foreground">
        <CardHeader className="flex flex-col gap-5 border-b border-border/70 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Roster</div>
            <CardTitle className="text-2xl">
              {event.name} - {new Date(event.gameStart).toLocaleDateString("en-GB")}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {event.map} • {event.side} • {assignedCount} assigned
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <Badge variant={board.published ? "default" : "secondary"} className="w-fit rounded-full px-3 py-1">
              {board.published ? dictionary.common.published : dictionary.common.unpublished}
            </Badge>
            {canAdmin ? (
              <div className="flex flex-wrap gap-2">
                <Button variant={editMode ? "default" : "outline"} className="rounded-xl" onClick={() => setEditMode((value) => !value)}>
                  <Settings2 className="size-4" />
                  {editMode ? "Editing enabled" : "Edit roster"}
                </Button>
                <Button variant="default" className="rounded-xl">
                  <Send className="size-4" />
                  {board.published ? "Update published roster" : "Publish roster"}
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-4 lg:p-5">
          <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <RosterInfoCard label="Match time" value={formatDateTime(event.meetingStart)} />
              <RosterInfoCard label="Opponent" value={event.name.split("vs")[1]?.trim() ?? "TBD"} />
              <RosterInfoCard label="Map & side" value={`${event.map ?? "TBD"} • ${event.side ?? "TBD"}`} />
              <RosterInfoCard label="Notes" value={event.notes ?? "No extra notes yet."} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {editMode ? (
                <div className="md:col-span-2">
                  <Button variant="outline" className="rounded-xl" onClick={addRosterSquad}>
                    <Plus className="size-4" />
                    Add squad
                  </Button>
                </div>
              ) : null}
              {board.squads
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((squad, squadIndex) => (
                  <Card
                    key={`${squad.group}-${squad.name}-${squadIndex}`}
                    className="rounded-2xl border-border/70 bg-card"
                    style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${squad.color} 60%, transparent)` }}
                  >
                    <CardHeader className="pb-3">
                      {editMode ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium">Squad setup</div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" className="size-8 rounded-xl" onClick={() => removeRosterSquad(squadIndex)}>
                                <Trash2 className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-8 rounded-xl" onClick={() => moveSquad(squadIndex, -1)}>
                                <ArrowUp className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-8 rounded-xl" onClick={() => moveSquad(squadIndex, 1)}>
                                <ArrowDown className="size-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid gap-3">
                            <Input value={squad.name} onChange={(event) => updateSquadField(squadIndex, "name", event.target.value)} className="rounded-xl" />
                            <Input value={squad.group} onChange={(event) => updateSquadField(squadIndex, "group", event.target.value)} className="rounded-xl" />
                            <Input type="color" value={squad.color} onChange={(event) => updateSquadField(squadIndex, "color", event.target.value)} className="h-11 rounded-xl p-1" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <CardTitle className="text-lg">{squad.name}</CardTitle>
                            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{squad.group}</div>
                          </div>
                          <Badge className="rounded-full border-0" style={{ backgroundColor: squad.color, color: "#08111f" }}>
                            {squad.players.length} slots
                          </Badge>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {squad.players.map((player, playerIndex) => {
                        const slotUser = users.find((user) => user.id === player.id);

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
                                <Input
                                  value={player.roleName ?? ""}
                                  onChange={(event) => updatePlayerField(squadIndex, playerIndex, "roleName", event.target.value)}
                                  className="h-8 rounded-lg text-xs"
                                />
                              ) : (
                                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{player.roleName ?? "Role"}</div>
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
                                  className="flex cursor-grab items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2"
                                >
                                  {editMode && canAdmin ? <GripVertical className="size-4 text-muted-foreground" /> : null}
                                  <Avatar className="size-8 rounded-lg">
                                    <AvatarImage src={slotUser.avatar} alt={slotUser.name} />
                                    <AvatarFallback>{slotUser.name.slice(0, 2)}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-medium">{slotUser.name}</div>
                                    <div className="truncate text-xs text-muted-foreground">{player.note ?? "Ready for assignment"}</div>
                                  </div>
                                  {player.ack ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Radio className="size-4 text-amber-500" />}
                                </div>
                                {editMode ? (
                                  <Input
                                    value={player.note ?? ""}
                                    onChange={(event) => updatePlayerField(squadIndex, playerIndex, "note", event.target.value)}
                                    placeholder="Player note"
                                    className="rounded-lg"
                                  />
                                ) : null}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="rounded-xl border border-dashed border-border/80 px-3 py-4 text-sm text-muted-foreground">
                                  {player.note ?? "Open slot"}
                                </div>
                                {editMode ? (
                                  <Input
                                    value={player.note ?? ""}
                                    onChange={(event) => updatePlayerField(squadIndex, playerIndex, "note", event.target.value)}
                                    placeholder="Slot note"
                                    className="rounded-lg"
                                  />
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {editMode ? (
                        <Button variant="outline" className="w-full rounded-xl" onClick={() => addRosterSlot(squadIndex)}>
                          <Plus className="size-4" />
                          Add slot
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
            </div>

            <Card className="rounded-2xl border-border/70 bg-card" onDragOver={(event) => editMode && event.preventDefault()} onDrop={() => handleDropOnReserve()}>
              <CardHeader>
                <CardTitle className="text-base">{dictionary.common.reserves}</CardTitle>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search reserves..."
                  className="rounded-xl"
                />
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[720px] pr-4">
                  <div className="space-y-2">
                    {reserveUsers.map((user) => (
                      <div
                        key={user.id}
                        onDragOver={(event) => editMode && event.preventDefault()}
                        onDrop={() => handleDropOnReserve(user.id)}
                      >
                        <div
                          draggable={editMode && canAdmin}
                          onDragStart={() => setDragState({ type: "reserve", userId: user.id })}
                          onDragEnd={() => setDragState(null)}
                          className="flex cursor-grab items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2"
                        >
                          {editMode && canAdmin ? <GripVertical className="size-4 text-muted-foreground" /> : null}
                          <Avatar className="size-8 rounded-lg">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">Score {user.score}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!reserveUsers.length ? (
                      <div className="rounded-xl border border-dashed border-border/80 px-3 py-6 text-center text-sm text-muted-foreground">
                        No reserves match this filter.
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
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
