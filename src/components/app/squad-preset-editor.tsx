"use client";

import { memo, useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, PencilLine, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Dictionary } from "@/i18n/dictionaries";
import { createHllStarterSquadPreset, roleIconOptions } from "@/lib/squad-preset-templates";
import type { Group, SquadPresetSquad } from "@/types/domain";

function IconPreview({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="size-5 object-contain invert dark:invert-0" />;
}

const IconSelect = memo(function IconSelect({
  defaultValue,
  onChange,
}: {
  defaultValue: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select defaultValue={defaultValue} onValueChange={onChange}>
      <SelectTrigger className="w-14 rounded-xl px-2">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roleIconOptions.map((iconPath) => (
          <SelectItem key={iconPath} value={iconPath}>
            <span>
              <IconPreview src={iconPath} alt="" />
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

type EditorRole = SquadPresetSquad["roles"][number] & {
  editorId: string;
};

type EditorSquad = Omit<SquadPresetSquad, "roles"> & {
  editorId: string;
  roles: EditorRole[];
};

function createEditorId() {
  return crypto.randomUUID();
}

function toEditorSquads(squads: SquadPresetSquad[]): EditorSquad[] {
  return squads.map((squad) => ({
    ...squad,
    editorId: createEditorId(),
    roles: squad.roles.map((role) => ({
      ...role,
      editorId: createEditorId(),
    })),
  }));
}

function toPersistedSquads(squads: EditorSquad[]): SquadPresetSquad[] {
  return squads.map(({ editorId: _editorId, roles, ...squad }) => ({
    ...squad,
    roles: roles.map(({ editorId: _roleEditorId, ...role }) => role),
  }));
}

export function SquadPresetEditor({
  name,
  squads,
  groups,
  canEdit,
  dictionary,
  serverId,
  locale,
  presetId,
  startInEditMode = false,
}: {
  name: string;
  squads: SquadPresetSquad[];
  groups: Group[];
  canEdit: boolean;
  dictionary: Dictionary;
  serverId: string;
  locale: string;
  presetId?: string;
  startInEditMode?: boolean;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const draftNameRef = useRef(name);
  const draftSquadsRef = useRef<EditorSquad[]>(toEditorSquads(squads));
  const [renderDraftName, setRenderDraftName] = useState(name);
  const [renderDraftSquads, setRenderDraftSquads] = useState<EditorSquad[]>(() => toEditorSquads(squads));
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const createMode = !presetId;

  function syncRenderedDraft() {
    setRenderDraftName(draftNameRef.current);
    setRenderDraftSquads([...draftSquadsRef.current]);
  }

  function resetDraft() {
    draftNameRef.current = name;
    draftSquadsRef.current = toEditorSquads(squads);
    setRenderDraftName(name);
    setRenderDraftSquads(draftSquadsRef.current);
  }

  useEffect(() => {
    resetDraft();
  }, [name, squads]);

  function moveSquad(index: number, direction: -1 | 1) {
    const current = draftSquadsRef.current;
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    draftSquadsRef.current = next.map((squad, order) => ({ ...squad, order }));
    syncRenderedDraft();
  }

  function updateSquad(index: number, field: keyof SquadPresetSquad, value: string | number) {
    const squad = draftSquadsRef.current[index];
    if (!squad) return;
    draftSquadsRef.current[index] = { ...squad, [field]: value };
  }

  function updateRole(squadIndex: number, roleIndex: number, field: "name" | "count" | "note" | "icon" | "color", value: string | number) {
    const squad = draftSquadsRef.current[squadIndex];
    const role = squad?.roles[roleIndex];
    if (!squad || !role) return;
    squad.roles[roleIndex] = { ...role, [field]: value };
  }

  function addSquad() {
    draftSquadsRef.current = [
      ...draftSquadsRef.current,
      {
        editorId: createEditorId(),
        name: dictionary.presets.newSquad,
        group: dictionary.roster.defaultSquadGroup,
        order: draftSquadsRef.current.length,
        color: "#64748b",
        icon: "/img/roles/icn_officer.png",
        roles: [
          {
            editorId: createEditorId(),
            name: dictionary.presets.newRole,
            color: "#64748b",
            icon: "/img/roles/icn_Rifleman.png",
            count: 1,
          },
        ],
      },
    ];
    syncRenderedDraft();
  }

  function removeSquad(index: number) {
    draftSquadsRef.current = draftSquadsRef.current
      .filter((_, squadIndex) => squadIndex !== index)
      .map((squad, order) => ({ ...squad, order }));
    syncRenderedDraft();
  }

  function addRole(squadIndex: number) {
    const squad = draftSquadsRef.current[squadIndex];
    if (!squad) return;
    squad.roles = [
      ...squad.roles,
      {
        editorId: createEditorId(),
        name: dictionary.presets.newRole,
        color: squad.color,
        icon: "/img/roles/icn_Rifleman.png",
        count: 1,
      },
    ];
    syncRenderedDraft();
  }

  function removeRole(squadIndex: number, roleIndex: number) {
    const squad = draftSquadsRef.current[squadIndex];
    if (!squad) return;
    squad.roles = squad.roles.filter((_, currentRoleIndex) => currentRoleIndex !== roleIndex);
    syncRenderedDraft();
  }

  function applyStarterPreset() {
    draftNameRef.current = draftNameRef.current || dictionary.presets.starterTemplateName;
    draftSquadsRef.current = toEditorSquads(createHllStarterSquadPreset());
    setIsEditing(true);
    syncRenderedDraft();
    toast.success(dictionary.presets.importStarterTemplate);
  }

  async function handleSave() {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const response = await fetch(
        createMode ? `/api/servers/${serverId}/squad-presets` : `/api/servers/${serverId}/squad-presets/${presetId}`,
        {
          method: createMode ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: draftNameRef.current,
            squads: toPersistedSquads(draftSquadsRef.current),
          }),
        },
      );

      const body = await response.json();
      if (!response.ok) {
        const message = body.error ?? "Unable to save the squad preset.";
        toast.error(message);
        return;
      }

      setIsEditing(false);
      setRenderDraftName(draftNameRef.current);
      setRenderDraftSquads([...draftSquadsRef.current]);
      toast.success(dictionary.common.save);
      startTransition(() => {
        router.push(`/${locale}/dashboard/servers/${serverId}/squad-presets/${createMode ? body.presetId : presetId}`);
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save the squad preset.");
    } finally {
      setIsSaving(false);
    }
  }

  const disabled = !canEdit || isSaving || isPending;

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{dictionary.presets.presetSetup}</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            {dictionary.presets.presetSetupDescription}
          </p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={applyStarterPreset}>
              <Sparkles className="size-4" />
              {dictionary.presets.importStarterTemplate}
            </Button>
            <Button variant={isEditing ? "secondary" : "default"} className="rounded-xl" onClick={() => setIsEditing((value) => !value)}>
              <PencilLine className="size-4" />
              {dictionary.common.edit}
            </Button>
            {isEditing ? (
              <>
                <Button variant="outline" className="rounded-xl" onClick={addSquad}>
                  <Plus className="size-4" />
                  {dictionary.common.addSquad}
                </Button>
                <Button variant="default" className="rounded-xl" onClick={() => void handleSave()} disabled={disabled}>
                  {isSaving || isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {dictionary.common.save}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="mb-2 text-sm font-medium">{dictionary.presets.presetName}</div>
          {isEditing ? (
            <Input
              key={`preset-name-${renderDraftName}-${renderDraftSquads.length}`}
              defaultValue={renderDraftName}
              onChange={(event) => {
                draftNameRef.current = event.target.value;
              }}
              className="rounded-xl"
            />
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">{renderDraftName || dictionary.presets.untitledPreset}</div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {renderDraftSquads.map((squad, squadIndex) => (
            <div key={squad.editorId} className="rounded-2xl border border-border/60 p-3">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{dictionary.presets.squadBlock}</div>
                    <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => removeSquad(squadIndex)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2 grid-cols-[auto_auto_56px_72px_56px_auto_auto] items-center">
                    <Input defaultValue={squad.name} onChange={(event) => updateSquad(squadIndex, "name", event.target.value)} className="rounded-xl" />
                    {groups.length ? (
                      <Select defaultValue={squad.group} onValueChange={(value) => updateSquad(squadIndex, "group", value)}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.name}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input defaultValue={squad.group} onChange={(event) => updateSquad(squadIndex, "group", event.target.value)} className="rounded-xl" />
                    )}
                    <Input type="color" defaultValue={squad.color} onChange={(event) => updateSquad(squadIndex, "color", event.target.value)} className="h-9 rounded-xl p-1" />
                    <Input type="number" defaultValue={squad.order} onChange={(event) => updateSquad(squadIndex, "order", Number(event.target.value))} className="h-9 rounded-xl" />
                    <IconSelect defaultValue={squad.icon} onChange={(value) => updateSquad(squadIndex, "icon", value)} />
                    <Button variant="outline" className="rounded-xl" onClick={() => moveSquad(squadIndex, -1)}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => moveSquad(squadIndex, 1)}>
                      <ArrowDown className="size-4" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {squad.roles.map((role, roleIndex) => (
                      <div key={role.editorId} className="rounded-xl border border-border/60 p-2.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{dictionary.presets.role}</div>
                          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => removeRole(squadIndex, roleIndex)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <div className="grid gap-2 grid-cols-[2fr_60px_56px_1fr] items-center">
                          <Input defaultValue={role.name} onChange={(event) => updateRole(squadIndex, roleIndex, "name", event.target.value)} className="h-9 rounded-xl" />
                          <Input type="number" defaultValue={role.count} onChange={(event) => updateRole(squadIndex, roleIndex, "count", Number(event.target.value))} className="h-9 rounded-xl" />
                          <IconSelect defaultValue={role.icon} onChange={(value) => updateRole(squadIndex, roleIndex, "icon", value)} />
                          <Input
                            defaultValue={role.note ?? ""}
                            onChange={(event) => updateRole(squadIndex, roleIndex, "note", event.target.value)}
                            className="h-9 rounded-xl"
                            placeholder={dictionary.presets.shortNote}
                          />
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" className="rounded-xl" onClick={() => addRole(squadIndex)}>
                      <Plus className="size-4" />
                      {dictionary.presets.addRole}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <img src={squad.icon} alt="" className="size-6 object-contain invert dark:invert-0" />
                      <div className="font-medium">{squad.name}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">{squad.group}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {squad.roles.map((role) => (
                      <div key={`${squad.name}-${role.name}`} className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-sm">
                        <img src={role.icon} alt="" className="size-4.5 object-contain invert dark:invert-0" />
                        <span>{role.name} x{role.count}</span>
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
            <Button className="rounded-xl" onClick={() => void handleSave()} disabled={disabled}>
              {isSaving || isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              {dictionary.common.save}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                resetDraft();
                setIsEditing(false);
              }}
            >
              {dictionary.common.cancel}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
