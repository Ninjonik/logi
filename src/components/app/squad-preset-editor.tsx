"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import type { SquadPresetSquad } from "@/types/domain";

export function SquadPresetEditor({
  name,
  squads,
  canEdit,
  dictionary,
  startInEditMode = false,
}: {
  name: string;
  squads: SquadPresetSquad[];
  canEdit: boolean;
  dictionary: Dictionary;
  startInEditMode?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [draftName, setDraftName] = useState(name);
  const [draftSquads, setDraftSquads] = useState(squads);

  function moveSquad(index: number, direction: -1 | 1) {
    setDraftSquads((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((squad, order) => ({ ...squad, order }));
    });
  }

  function updateSquad(index: number, field: keyof SquadPresetSquad, value: string | number) {
    setDraftSquads((current) => current.map((squad, squadIndex) => (squadIndex === index ? { ...squad, [field]: value } : squad)));
  }

  function updateRole(squadIndex: number, roleIndex: number, field: "name" | "count" | "note" | "icon" | "color", value: string | number) {
    setDraftSquads((current) =>
      current.map((squad, currentSquadIndex) =>
        currentSquadIndex !== squadIndex
          ? squad
          : {
              ...squad,
              roles: squad.roles.map((role, currentRoleIndex) =>
                currentRoleIndex === roleIndex ? { ...role, [field]: value } : role,
              ),
            },
      ),
    );
  }

  function addSquad() {
    setDraftSquads((current) => [
      ...current,
      {
        name: "New squad",
        group: "Infantry Squad",
        order: current.length,
        color: "#64748b",
        roles: [{ name: "Rifleman", color: "#64748b", icon: "users", count: 1 }],
      },
    ]);
  }

  function removeSquad(index: number) {
    setDraftSquads((current) => current.filter((_, squadIndex) => squadIndex !== index).map((squad, order) => ({ ...squad, order })));
  }

  function addRole(squadIndex: number) {
    setDraftSquads((current) =>
      current.map((squad, index) =>
        index === squadIndex
          ? {
              ...squad,
              roles: [...squad.roles, { name: "New role", color: squad.color, icon: "users", count: 1 }],
            }
          : squad,
      ),
    );
  }

  function removeRole(squadIndex: number, roleIndex: number) {
    setDraftSquads((current) =>
      current.map((squad, index) =>
        index === squadIndex
          ? { ...squad, roles: squad.roles.filter((_, currentRoleIndex) => currentRoleIndex !== roleIndex) }
          : squad,
      ),
    );
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Preset setup</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Preset information and squad structure live in one editor so the whole setup stays together.
          </p>
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <Button variant={isEditing ? "secondary" : "default"} className="rounded-xl" onClick={() => setIsEditing((value) => !value)}>
              <PencilLine className="size-4" />
              {dictionary.common.edit}
            </Button>
            {isEditing ? (
              <Button variant="outline" className="rounded-xl" onClick={addSquad}>
                <Plus className="size-4" />
                Add squad
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="mb-2 text-sm font-medium">Preset name</div>
          {isEditing ? (
            <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} className="rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">{draftName || "Untitled preset"}</div>
          )}
        </div>

        <div className="space-y-4">
          {draftSquads.map((squad, squadIndex) => (
            <div key={`${squad.name}-${squadIndex}`} className="rounded-2xl border border-border/60 p-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Squad block</div>
                    <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => removeSquad(squadIndex)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input value={squad.name} onChange={(event) => updateSquad(squadIndex, "name", event.target.value)} className="rounded-xl" />
                    <Input value={squad.group} onChange={(event) => updateSquad(squadIndex, "group", event.target.value)} className="rounded-xl" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr_140px_auto_auto]">
                    <Input type="color" value={squad.color} onChange={(event) => updateSquad(squadIndex, "color", event.target.value)} className="h-11 rounded-xl p-1" />
                    <Input type="number" value={squad.order} onChange={(event) => updateSquad(squadIndex, "order", Number(event.target.value))} className="rounded-xl" />
                    <Button variant="outline" className="rounded-xl" onClick={() => moveSquad(squadIndex, -1)}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => moveSquad(squadIndex, 1)}>
                      <ArrowDown className="size-4" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {squad.roles.map((role, roleIndex) => (
                      <div key={`${role.name}-${roleIndex}`} className="rounded-xl border border-border/60 p-3">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">Role</div>
                          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => removeRole(squadIndex, roleIndex)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <Input value={role.name} onChange={(event) => updateRole(squadIndex, roleIndex, "name", event.target.value)} className="rounded-xl" />
                          <Input type="number" value={role.count} onChange={(event) => updateRole(squadIndex, roleIndex, "count", Number(event.target.value))} className="rounded-xl" />
                          <Input value={role.icon} onChange={(event) => updateRole(squadIndex, roleIndex, "icon", event.target.value)} className="rounded-xl" />
                          <Input type="color" value={role.color} onChange={(event) => updateRole(squadIndex, roleIndex, "color", event.target.value)} className="h-11 rounded-xl p-1" />
                        </div>
                        <Textarea
                          value={role.note ?? ""}
                          onChange={(event) => updateRole(squadIndex, roleIndex, "note", event.target.value)}
                          className="mt-3 min-h-20 rounded-xl"
                          placeholder="Role note"
                        />
                      </div>
                    ))}
                    <Button variant="outline" className="rounded-xl" onClick={() => addRole(squadIndex)}>
                      <Plus className="size-4" />
                      Add role
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{squad.name}</div>
                    <div className="text-sm text-muted-foreground">{squad.group}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {squad.roles.map((role) => (
                      <div key={`${squad.name}-${role.name}`} className="rounded-full border border-border/60 px-3 py-1 text-sm">
                        {role.name} x{role.count}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {isEditing ? (
          <div className="flex gap-3">
            <Button className="rounded-xl">{dictionary.common.save}</Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setIsEditing(false)}>
              {dictionary.common.cancel}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
