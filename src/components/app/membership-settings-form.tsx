"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DiscordEntitySelect, type DiscordSelectOption } from "@/components/app/discord-entity-select";
import { DiscordMultiEntitySelect } from "@/components/app/discord-multi-entity-select";
import { AvatarPicker } from "@/components/app/avatar-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { DiscordConfig, MembershipCategory, MembershipSettings, TicketModalQuestion } from "@/types/domain";

type DiscordMetadata = {
  roles: DiscordSelectOption[];
  channels: Array<DiscordSelectOption & { type: number; parentId?: string }>;
  emojis: DiscordSelectOption[];
};

const MAX_FIELD_LENGTH = 1024;

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildDefaultQuestion(): TicketModalQuestion {
  return {
    id: makeId("question"),
    label: "",
    placeholder: "",
    style: "short",
    required: true,
  };
}

function buildDefaultCategory(): MembershipCategory {
  return {
    id: makeId("membership"),
    emoji: "",
    label: "",
    description: "",
    supportRoleIds: [],
    recruitRoleId: "",
    finalRoleId: "",
    modalQuestions: [],
    assignmentType: "member",
  };
}

function buildDefaultSettings(config?: DiscordConfig | null): MembershipSettings {
  if (config?.membershipSettings) {
    return {
      ...config.membershipSettings,
      panelImageUrl: config.membershipSettings.panelImageUrl ?? "",
      categories: config.membershipSettings.categories.map((category) => ({
        ...category,
        emoji: category.emoji ?? "",
        label: category.label ?? "",
        description: category.description ?? "",
        recruitRoleId: category.recruitRoleId ?? "",
        finalRoleId: category.finalRoleId ?? "",
        supportRoleIds: [...category.supportRoleIds],
        modalQuestions: category.modalQuestions.map((question) => ({
          ...question,
          placeholder: question.placeholder ?? "",
        })),
      })),
    };
  }

  return {
    enabled: false,
    submitChannelId: "",
    applicationParentChannelId: "",
    panelTitle: "Apply to the clan",
    panelDescription: "Pick the application type that matches you. If we still need your platform ID, we will guide you through it first.",
    panelImageUrl: "",
    autoAssignRecruitOnApply: false,
    categories: [],
  };
}

function buildFieldPreview(categories: MembershipCategory[]) {
  const lines = categories.map((category) => {
    const pieces = [category.emoji?.trim(), category.label?.trim()].filter(Boolean);
    const heading = pieces.join(" ") || category.id;
    return category.description?.trim() ? `${heading}: ${category.description.trim()}` : heading;
  });

  return {
    length: lines.join("\n").length,
    tooLong: lines.join("\n").length > MAX_FIELD_LENGTH,
  };
}

export function MembershipSettingsForm({
  serverId,
  config,
}: {
  serverId: string;
  config: DiscordConfig | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [metadata, setMetadata] = useState<DiscordMetadata | null>(null);
  const [settings, setSettings] = useState<MembershipSettings>(buildDefaultSettings(config));

  useEffect(() => {
    fetch(`/api/servers/${serverId}/discord-metadata`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body || !Array.isArray(body.channels) || !Array.isArray(body.roles) || !Array.isArray(body.emojis)) {
          throw new Error("Unable to load Discord metadata.");
        }
        setMetadata(body);
      })
      .catch(() => setMetadata(null));
  }, [serverId]);

  const roles = metadata?.roles ?? [];
  const textChannels = metadata?.channels?.filter((channel) => channel.type === 0) ?? [];
  const emojiOptions = metadata?.emojis ?? [];
  const preview = useMemo(() => buildFieldPreview(settings.categories), [settings.categories]);

  function patchSettings(patch: Partial<MembershipSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function patchCategory(categoryId: string, patch: Partial<MembershipCategory>) {
    setSettings((current) => ({
      ...current,
      categories: current.categories.map((category) => category.id === categoryId ? { ...category, ...patch } : category),
    }));
  }

  function patchQuestion(categoryId: string, questionId: string, patch: Partial<TicketModalQuestion>) {
    setSettings((current) => ({
      ...current,
      categories: current.categories.map((category) => category.id !== categoryId ? category : {
        ...category,
        modalQuestions: category.modalQuestions.map((question) => question.id === questionId ? { ...question, ...patch } : question),
      }),
    }));
  }

  async function handleSave() {
    const membershipSettings = settings.enabled ? {
      enabled: true,
      submitChannelId: settings.submitChannelId || undefined,
      applicationParentChannelId: settings.applicationParentChannelId || undefined,
      panelTitle: settings.panelTitle,
      panelDescription: settings.panelDescription,
      panelImageUrl: settings.panelImageUrl || undefined,
      autoAssignRecruitOnApply: settings.autoAssignRecruitOnApply,
      categories: settings.categories.map((category) => ({
        ...category,
        emoji: category.emoji?.trim() || undefined,
        label: category.label?.trim() || undefined,
        description: category.description?.trim() || undefined,
        recruitRoleId: category.recruitRoleId?.trim() || undefined,
        finalRoleId: category.finalRoleId?.trim() || undefined,
        modalQuestions: category.modalQuestions.map((question) => ({
          ...question,
          placeholder: question.placeholder?.trim() || undefined,
        })),
      })),
    } : {
      ...settings,
      enabled: false,
    };

    const response = await fetch(`/api/servers/${serverId}/discord-settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        timezone: config?.timezone ?? "UTC",
        defaultLanguage: config?.defaultLanguage ?? "en",
        announcementsChannelId: config?.announcementsChannelId,
        forumCategoryId: config?.forumCategoryId,
        meetingChannelId: config?.meetingChannelId,
        clanRoleId: config?.clanRoleId,
        dashboardAdminRoleId: config?.dashboardAdminRoleId,
        ticketSettings: config?.ticketSettings,
        membershipSettings,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      toast.error(body.error ?? "Unable to save membership settings.");
      return;
    }

    toast.success("Membership settings saved.");
    startTransition(() => router.refresh());
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>Membership settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 p-4">
          <div className="space-y-1">
            <h3 className="font-semibold">Enable membership applications</h3>
            <p className="text-sm text-muted-foreground">Post a clan application embed in Discord and open staff-managed private threads from it.</p>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={(checked) => patchSettings({ enabled: checked })} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Submit embed channel</Label>
            <DiscordEntitySelect value={settings.submitChannelId} onChange={(value) => patchSettings({ submitChannelId: value ?? "" })} options={textChannels} placeholder="Submit embed channel" />
          </div>
          <div className="space-y-2">
            <Label>Application thread parent</Label>
            <DiscordEntitySelect value={settings.applicationParentChannelId} onChange={(value) => patchSettings({ applicationParentChannelId: value ?? "" })} options={textChannels} placeholder="Application thread parent" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 p-4">
          <div className="space-y-1">
            <h3 className="font-semibold">Skip pending phase</h3>
            <p className="text-sm text-muted-foreground">New member applications start as recruits immediately after submission.</p>
          </div>
          <Switch checked={settings.autoAssignRecruitOnApply} onCheckedChange={(checked) => patchSettings({ autoAssignRecruitOnApply: checked })} />
        </div>

        <div className="space-y-2">
          <Label>Panel title</Label>
          <Input value={settings.panelTitle} onChange={(event) => patchSettings({ panelTitle: event.target.value })} maxLength={256} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Panel description</Label>
          <Textarea value={settings.panelDescription} onChange={(event) => patchSettings({ panelDescription: event.target.value })} maxLength={4096} className="min-h-32 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Thumbnail image</Label>
          <AvatarPicker
            value={settings.panelImageUrl ?? ""}
            onChange={(value) => patchSettings({ panelImageUrl: value ?? "" })}
            fallback="CA"
            label="Application thumbnail"
            buttonLabel="Upload image"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">Application categories</h3>
              <p className="text-sm text-muted-foreground">Each category becomes a button. Modal questions are optional and reuse the same pattern as tickets.</p>
            </div>
            <Button type="button" variant="secondary" className="rounded-xl" onClick={() => patchSettings({ categories: [...settings.categories, buildDefaultCategory()] })}>
              <Plus className="size-4" />
              Add category
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Embed field usage: {preview.length} / {MAX_FIELD_LENGTH} {preview.tooLong ? "(too long, trim category descriptions before saving)" : ""}
          </p>

          {settings.categories.length ? settings.categories.map((category) => (
            <div key={category.id} className="space-y-4 rounded-2xl border border-border/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-medium">{category.label?.trim() || category.id}</h4>
                  <p className="text-xs text-muted-foreground">ID: {category.id}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={() => patchSettings({ categories: settings.categories.filter((item) => item.id !== category.id) })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Button label</Label>
                  <Input value={category.label} onChange={(event) => patchCategory(category.id, { label: event.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Application result</Label>
                  <Select value={category.assignmentType} onValueChange={(value) => patchCategory(category.id, { assignmentType: value as "member" | "mercenary" })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="mercenary">Mercenary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr,2fr]">
                <div className="space-y-2">
                  <Label>Emoji</Label>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                    <DiscordEntitySelect
                      value={emojiOptions.some((option) => option.id === category.emoji) ? category.emoji : undefined}
                      onChange={(value) => patchCategory(category.id, { emoji: value ?? "" })}
                      options={emojiOptions}
                      placeholder="Pick server emoji"
                    />
                    <Input
                      value={category.emoji ?? ""}
                      onChange={(event) => patchCategory(category.id, { emoji: event.target.value })}
                      placeholder="or type any emoji"
                      maxLength={100}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={category.description} onChange={(event) => patchCategory(category.id, { description: event.target.value })} className="rounded-xl" />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Recruit role for this category</Label>
                  <DiscordEntitySelect
                    value={category.recruitRoleId}
                    onChange={(value) => patchCategory(category.id, { recruitRoleId: value ?? "" })}
                    options={roles}
                    placeholder="Recruit role"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Final role for this category</Label>
                  <DiscordEntitySelect
                    value={category.finalRoleId}
                    onChange={(value) => patchCategory(category.id, { finalRoleId: value ?? "" })}
                    options={roles}
                    placeholder="Final role"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Support roles</Label>
                <DiscordMultiEntitySelect value={category.supportRoleIds} onChange={(value) => patchCategory(category.id, { supportRoleIds: value })} options={roles} placeholder="Support roles" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h5 className="font-medium">Modal questions</h5>
                    <p className="text-sm text-muted-foreground">Up to 5 text inputs, just like the ticket modal flow.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={category.modalQuestions.length >= 5}
                    onClick={() => patchCategory(category.id, { modalQuestions: [...category.modalQuestions, buildDefaultQuestion()] })}
                  >
                    <Plus className="size-4" />
                    Add question
                  </Button>
                </div>

                {category.modalQuestions.length ? category.modalQuestions.map((question) => (
                  <div key={question.id} className="grid gap-4 rounded-2xl border border-border/60 p-4 lg:grid-cols-[2fr,1fr,auto]">
                    <div className="space-y-2">
                      <Label>Question label</Label>
                      <Input value={question.label} onChange={(event) => patchQuestion(category.id, question.id, { label: event.target.value })} className="rounded-xl" />
                      <Input value={question.placeholder} onChange={(event) => patchQuestion(category.id, question.id, { placeholder: event.target.value })} placeholder="Placeholder" className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>Input style</Label>
                      <Select value={question.style} onValueChange={(value) => patchQuestion(category.id, question.id, { style: value as "short" | "paragraph" })}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">Short</SelectItem>
                          <SelectItem value="paragraph">Paragraph</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-3 pt-2">
                        <Switch checked={question.required} onCheckedChange={(checked) => patchQuestion(category.id, question.id, { required: checked })} />
                        <span className="text-sm text-muted-foreground">Required</span>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="self-start rounded-xl" onClick={() => patchCategory(category.id, { modalQuestions: category.modalQuestions.filter((item) => item.id !== question.id) })}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                    No modal questions yet. Leave this empty if the category should open the thread immediately after the precheck.
                  </div>
                )}
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              No application categories yet.
            </div>
          )}
        </div>

        <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
          Save membership settings
        </Button>
      </CardContent>
    </Card>
  );
}
