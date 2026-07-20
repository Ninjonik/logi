"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DiscordEntitySelect, type DiscordSelectOption } from "@/components/app/discord-entity-select";
import { DiscordMultiEntitySelect } from "@/components/app/discord-multi-entity-select";
import { AvatarPicker } from "@/components/app/avatar-picker";
import { ConfigNotice } from "@/components/app/config-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
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

function buildDefaultSettings(dictionary: Dictionary, config?: DiscordConfig | null): MembershipSettings {
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
    panelTitle: dictionary.membershipSettings.defaultPanelTitle,
    panelDescription: dictionary.membershipSettings.defaultPanelDescription,
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
  dictionary,
}: {
  serverId: string;
  config: DiscordConfig | null;
  dictionary: Dictionary;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [metadata, setMetadata] = useState<DiscordMetadata | null>(null);
  const [settings, setSettings] = useState<MembershipSettings>(buildDefaultSettings(dictionary, config));

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
  const missingMembershipParts: string[] = [];
  if (!settings.submitChannelId) missingMembershipParts.push(dictionary.membershipSettings.submitChannel);
  if (!settings.applicationParentChannelId) missingMembershipParts.push(dictionary.membershipSettings.parentChannel);
  if (!settings.categories.length) missingMembershipParts.push(dictionary.membershipSettings.categoriesTitle);
  const memberCategoriesMissingRecruitRole = settings.categories.filter(
    (category) => category.assignmentType === "member" && !category.recruitRoleId,
  ).length;
  const categoriesMissingFinalRole = settings.categories.filter((category) => !category.finalRoleId).length;

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
      toast.error(body.error ?? dictionary.membershipSettings.saveError);
      return;
    }

    toast.success(dictionary.membershipSettings.saved);
    startTransition(() => router.refresh());
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>{dictionary.membershipSettings.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {settings.enabled && missingMembershipParts.length ? (
          <ConfigNotice title={dictionary.membershipSettings.incompleteTitle}>
            {dictionary.membershipSettings.incompleteDescription.replace("{items}", missingMembershipParts.join(", "))}
          </ConfigNotice>
        ) : null}
        <ConfigNotice tone="info" title={dictionary.membershipSettings.roleSyncTitle}>
          {dictionary.membershipSettings.roleSyncDescription}
        </ConfigNotice>
        {settings.enabled && (!config?.clanRoleId || memberCategoriesMissingRecruitRole > 0 || categoriesMissingFinalRole > 0) ? (
          <ConfigNotice title={dictionary.membershipSettings.rolesMissingTitle}>
            {!config?.clanRoleId ? dictionary.membershipSettings.rolesMissingClanRole : ""}
            {memberCategoriesMissingRecruitRole > 0
              ? dictionary.membershipSettings.rolesMissingRecruitRole
                .replace("{count}", String(memberCategoriesMissingRecruitRole))
                .replace("{noun}", memberCategoriesMissingRecruitRole === 1 ? dictionary.membershipSettings.singleCategory : dictionary.membershipSettings.multipleCategories)
                .replace("{verb}", memberCategoriesMissingRecruitRole === 1 ? dictionary.membershipSettings.singleIs : dictionary.membershipSettings.pluralAre)
              : ""}
            {categoriesMissingFinalRole > 0
              ? dictionary.membershipSettings.rolesMissingFinalRole
                .replace("{count}", String(categoriesMissingFinalRole))
                .replace("{noun}", categoriesMissingFinalRole === 1 ? dictionary.membershipSettings.singleCategory : dictionary.membershipSettings.multipleCategories)
                .replace("{verb}", categoriesMissingFinalRole === 1 ? dictionary.membershipSettings.singleIs : dictionary.membershipSettings.pluralAre)
              : ""}
            {dictionary.membershipSettings.rolesMissingSummary}
          </ConfigNotice>
        ) : null}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 p-4">
          <div className="space-y-1">
            <h3 className="font-semibold">{dictionary.membershipSettings.enableTitle}</h3>
            <p className="text-sm text-muted-foreground">{dictionary.membershipSettings.enableDescription}</p>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={(checked) => patchSettings({ enabled: checked })} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>{dictionary.membershipSettings.submitChannel}</Label>
            <DiscordEntitySelect value={settings.submitChannelId} onChange={(value) => patchSettings({ submitChannelId: value ?? "" })} options={textChannels} placeholder={dictionary.membershipSettings.submitChannel} />
          </div>
          <div className="space-y-2">
            <Label>{dictionary.membershipSettings.parentChannel}</Label>
            <DiscordEntitySelect value={settings.applicationParentChannelId} onChange={(value) => patchSettings({ applicationParentChannelId: value ?? "" })} options={textChannels} placeholder={dictionary.membershipSettings.parentChannel} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 p-4">
          <div className="space-y-1">
            <h3 className="font-semibold">{dictionary.membershipSettings.skipPendingTitle}</h3>
            <p className="text-sm text-muted-foreground">{dictionary.membershipSettings.skipPendingDescription}</p>
          </div>
          <Switch checked={settings.autoAssignRecruitOnApply} onCheckedChange={(checked) => patchSettings({ autoAssignRecruitOnApply: checked })} />
        </div>

        <div className="space-y-2">
          <Label>{dictionary.membershipSettings.panelTitle}</Label>
          <Input value={settings.panelTitle} onChange={(event) => patchSettings({ panelTitle: event.target.value })} maxLength={256} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>{dictionary.membershipSettings.panelDescription}</Label>
          <Textarea value={settings.panelDescription} onChange={(event) => patchSettings({ panelDescription: event.target.value })} maxLength={4096} className="min-h-32 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>{dictionary.membershipSettings.image}</Label>
          <AvatarPicker
            value={settings.panelImageUrl ?? ""}
            onChange={(value) => patchSettings({ panelImageUrl: value ?? "" })}
            fallback="CA"
            label={dictionary.membershipSettings.applicationThumbnail}
            buttonLabel={dictionary.common.upload}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">{dictionary.membershipSettings.categoriesTitle}</h3>
              <p className="text-sm text-muted-foreground">{dictionary.membershipSettings.categoriesDescription}</p>
            </div>
            <Button type="button" variant="secondary" className="rounded-xl" onClick={() => patchSettings({ categories: [...settings.categories, buildDefaultCategory()] })}>
              <Plus className="size-4" />
              {dictionary.membershipSettings.addCategory}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {dictionary.membershipSettings.embedFieldUsage.replace("{length}", String(preview.length)).replace("{max}", String(MAX_FIELD_LENGTH))} {preview.tooLong ? dictionary.membershipSettings.embedFieldTooLong : ""}
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
                  <Label>{dictionary.membershipSettings.buttonLabel}</Label>
                  <Input value={category.label} onChange={(event) => patchCategory(category.id, { label: event.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>{dictionary.membershipSettings.applicationResult}</Label>
                  <Select value={category.assignmentType} onValueChange={(value) => patchCategory(category.id, { assignmentType: value as "member" | "mercenary" })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">{dictionary.userManagement.memberLabel}</SelectItem>
                      <SelectItem value="mercenary">{dictionary.userManagement.mercLabel}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr,2fr]">
                <div className="space-y-2">
                  <Label>{dictionary.ticketSettings.emoji}</Label>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                    <DiscordEntitySelect
                      value={emojiOptions.some((option) => option.id === category.emoji) ? category.emoji : undefined}
                      onChange={(value) => patchCategory(category.id, { emoji: value ?? "" })}
                      options={emojiOptions}
                      placeholder={dictionary.ticketSettings.pickServerEmoji}
                    />
                    <Input
                      value={category.emoji ?? ""}
                      onChange={(event) => patchCategory(category.id, { emoji: event.target.value })}
                      placeholder={dictionary.ticketSettings.typeAnyEmoji}
                      maxLength={100}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{dictionary.ticketSettings.categoryDescription}</Label>
                  <Input value={category.description} onChange={(event) => patchCategory(category.id, { description: event.target.value })} className="rounded-xl" />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>{dictionary.membershipSettings.recruitRole}</Label>
                  <DiscordEntitySelect
                    value={category.recruitRoleId}
                    onChange={(value) => patchCategory(category.id, { recruitRoleId: value ?? "" })}
                    options={roles}
                    placeholder={dictionary.membershipSettings.recruitRolePlaceholder}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{dictionary.membershipSettings.finalRole}</Label>
                  <DiscordEntitySelect
                    value={category.finalRoleId}
                    onChange={(value) => patchCategory(category.id, { finalRoleId: value ?? "" })}
                    options={roles}
                    placeholder={dictionary.membershipSettings.finalRolePlaceholder}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{dictionary.ticketSettings.supportRoles}</Label>
                <DiscordMultiEntitySelect value={category.supportRoleIds} onChange={(value) => patchCategory(category.id, { supportRoleIds: value })} options={roles} placeholder={dictionary.ticketSettings.supportRoles} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h5 className="font-medium">{dictionary.ticketSettings.modalQuestions}</h5>
                    <p className="text-sm text-muted-foreground">{dictionary.membershipSettings.modalQuestionsDescription}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={category.modalQuestions.length >= 5}
                    onClick={() => patchCategory(category.id, { modalQuestions: [...category.modalQuestions, buildDefaultQuestion()] })}
                  >
                    <Plus className="size-4" />
                    {dictionary.ticketSettings.addQuestion}
                  </Button>
                </div>

                {category.modalQuestions.length ? category.modalQuestions.map((question) => (
                  <div key={question.id} className="grid gap-4 rounded-2xl border border-border/60 p-4 lg:grid-cols-[2fr,1fr,auto]">
                    <div className="space-y-2">
                      <Label>{dictionary.ticketSettings.questionText}</Label>
                      <Input value={question.label} onChange={(event) => patchQuestion(category.id, question.id, { label: event.target.value })} className="rounded-xl" />
                      <Input value={question.placeholder} onChange={(event) => patchQuestion(category.id, question.id, { placeholder: event.target.value })} placeholder={dictionary.ticketSettings.placeholder} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>{dictionary.ticketSettings.inputStyle}</Label>
                      <Select value={question.style} onValueChange={(value) => patchQuestion(category.id, question.id, { style: value as "short" | "paragraph" })}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">{dictionary.ticketSettings.shortInput}</SelectItem>
                          <SelectItem value="paragraph">{dictionary.ticketSettings.paragraphInput}</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-3 pt-2">
                        <Switch checked={question.required} onCheckedChange={(checked) => patchQuestion(category.id, question.id, { required: checked })} />
                        <span className="text-sm text-muted-foreground">{dictionary.ticketSettings.required}</span>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="self-start rounded-xl" onClick={() => patchCategory(category.id, { modalQuestions: category.modalQuestions.filter((item) => item.id !== question.id) })}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                    {dictionary.membershipSettings.noQuestions}
                  </div>
                )}
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              {dictionary.membershipSettings.noCategories}
            </div>
          )}
        </div>

        <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
          {dictionary.membershipSettings.save}
        </Button>
      </CardContent>
    </Card>
  );
}
