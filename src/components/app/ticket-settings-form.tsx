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
import type { Dictionary } from "@/i18n/dictionaries";
import type { DiscordConfig, TicketCategory, TicketModalQuestion, TicketSettings } from "@/types/domain";

type DiscordMetadata = {
  roles: DiscordSelectOption[];
  channels: Array<DiscordSelectOption & { type: number; parentId?: string }>;
  emojis: DiscordSelectOption[];
};

type EditableTicketQuestion = TicketModalQuestion;
type EditableTicketCategory = TicketCategory;

const MAX_TICKET_CATEGORY_FIELD_LENGTH = 1024;

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildDefaultTicketQuestion(): EditableTicketQuestion {
  return {
    id: makeId("question"),
    label: "",
    placeholder: "",
    style: "short",
    required: true,
  };
}

function buildDefaultTicketCategory(): EditableTicketCategory {
  return {
    id: makeId("category"),
    emoji: "",
    label: "",
    description: "",
    supportRoleIds: [],
    modalQuestions: [],
  };
}

function buildDefaultTicketSettings(config?: DiscordConfig | null): TicketSettings {
  if (config?.ticketSettings) {
    return {
      ...config.ticketSettings,
      panelTitle: config.ticketSettings.panelTitle ?? "",
      panelDescription: config.ticketSettings.panelDescription ?? "",
      panelImageUrl: config.ticketSettings.panelImageUrl ?? "",
      categories: config.ticketSettings.categories.map((category) => ({
        ...category,
        emoji: category.emoji ?? "",
        label: category.label ?? "",
        description: category.description ?? "",
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
    ticketParentChannelId: "",
    panelTitle: "Submit a ticket",
    panelDescription: "Pick the category that fits your issue best and we will open a private support thread for you.",
    panelImageUrl: "",
    categories: [],
  };
}

function buildTicketCategoryFieldPreview(categories: EditableTicketCategory[]) {
  const lines = categories
    .map((category) => {
      const pieces = [category.emoji?.trim(), category.label?.trim()].filter(Boolean);
      const title = pieces.join(" ") || category.id;
      const description = category.description?.trim();
      return description ? `${title}: ${description}` : title;
    })
    .filter(Boolean);

  const fullText = lines.join("\n");
  return {
    tooLong: fullText.length > MAX_TICKET_CATEGORY_FIELD_LENGTH,
    length: fullText.length,
  };
}

export function TicketSettingsForm({
  serverId,
  dictionary,
  config,
}: {
  serverId: string;
  dictionary: Dictionary;
  config: DiscordConfig | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [metadata, setMetadata] = useState<DiscordMetadata | null>(null);
  const [ticketSettings, setTicketSettings] = useState<TicketSettings>(buildDefaultTicketSettings(config));

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
  const categoryFieldPreview = useMemo(
    () => buildTicketCategoryFieldPreview(ticketSettings.categories),
    [ticketSettings.categories],
  );

  function patchTicketSettings(patch: Partial<TicketSettings>) {
    setTicketSettings((current) => ({ ...current, ...patch }));
  }

  function patchTicketCategory(categoryId: string, patch: Partial<EditableTicketCategory>) {
    setTicketSettings((current) => ({
      ...current,
      categories: current.categories.map((category) => (
        category.id === categoryId ? { ...category, ...patch } : category
      )),
    }));
  }

  function patchTicketQuestion(categoryId: string, questionId: string, patch: Partial<EditableTicketQuestion>) {
    setTicketSettings((current) => ({
      ...current,
      categories: current.categories.map((category) => (
        category.id !== categoryId
          ? category
          : {
            ...category,
            modalQuestions: category.modalQuestions.map((question) => (
              question.id === questionId ? { ...question, ...patch } : question
            )),
          }
      )),
    }));
  }

  async function handleSave() {
    const normalizedTicketSettings: TicketSettings | undefined = ticketSettings.enabled ? {
      enabled: true,
      submitChannelId: ticketSettings.submitChannelId || undefined,
      ticketParentChannelId: ticketSettings.ticketParentChannelId || undefined,
      panelTitle: ticketSettings.panelTitle,
      panelDescription: ticketSettings.panelDescription,
      panelImageUrl: ticketSettings.panelImageUrl || undefined,
      categories: ticketSettings.categories.map((category) => ({
        ...category,
        emoji: category.emoji?.trim() || undefined,
        label: category.label?.trim() || undefined,
        description: category.description?.trim() || undefined,
        supportRoleIds: category.supportRoleIds,
        modalQuestions: category.modalQuestions.map((question) => ({
          ...question,
          placeholder: question.placeholder?.trim() || undefined,
        })),
      })),
    } : {
      ...ticketSettings,
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
        ticketSettings: normalizedTicketSettings,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.error ?? dictionary.serverSettings.discordSettingsSaveError);
      return;
    }

    toast.success(dictionary.serverSettings.discordSettingsSaved);
    startTransition(() => router.refresh());
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>{dictionary.ticketSettings.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 p-4">
          <div className="space-y-1">
            <h3 className="font-semibold">{dictionary.ticketSettings.enableTitle}</h3>
            <p className="text-sm text-muted-foreground">{dictionary.ticketSettings.enableDescription}</p>
          </div>
          <Switch
            checked={ticketSettings.enabled}
            onCheckedChange={(checked) => patchTicketSettings({ enabled: checked })}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>{dictionary.ticketSettings.submitChannel}</Label>
            <DiscordEntitySelect
              value={ticketSettings.submitChannelId}
              onChange={(value) => patchTicketSettings({ submitChannelId: value ?? "" })}
              options={textChannels}
              placeholder={dictionary.ticketSettings.submitChannel}
            />
          </div>
          <div className="space-y-2">
            <Label>{dictionary.ticketSettings.parentChannel}</Label>
            <DiscordEntitySelect
              value={ticketSettings.ticketParentChannelId}
              onChange={(value) => patchTicketSettings({ ticketParentChannelId: value ?? "" })}
              options={textChannels}
              placeholder={dictionary.ticketSettings.parentChannel}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{dictionary.ticketSettings.panelTitle}</Label>
          <Input
            value={ticketSettings.panelTitle}
            onChange={(event) => patchTicketSettings({ panelTitle: event.target.value })}
            maxLength={256}
            placeholder="Submit a ticket"
          />
          <p className="text-xs text-muted-foreground">{ticketSettings.panelTitle.length}/256</p>
        </div>

        <div className="space-y-2">
          <Label>{dictionary.ticketSettings.panelDescription}</Label>
          <Textarea
            value={ticketSettings.panelDescription}
            onChange={(event) => patchTicketSettings({ panelDescription: event.target.value })}
            maxLength={4096}
            rows={4}
            placeholder={dictionary.ticketSettings.panelDescriptionPlaceholder}
          />
          <p className="text-xs text-muted-foreground">{ticketSettings.panelDescription.length}/4096</p>
        </div>

        <AvatarPicker
          value={ticketSettings.panelImageUrl ?? ""}
          onChange={(value) => patchTicketSettings({ panelImageUrl: value })}
          fallback="TK"
          label={dictionary.ticketSettings.image}
          buttonLabel={dictionary.common.upload}
          disabled={isPending}
          className="rounded-2xl border border-border/60 p-4"
        />

        <div className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
          {dictionary.ticketSettings.embedLimitNotice} {categoryFieldPreview.length}/{MAX_TICKET_CATEGORY_FIELD_LENGTH}
          {categoryFieldPreview.tooLong ? ` ${dictionary.ticketSettings.embedLimitExceeded}` : ""}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold">{dictionary.ticketSettings.categoriesTitle}</h4>
              <p className="text-sm text-muted-foreground">{dictionary.ticketSettings.categoriesDescription}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => patchTicketSettings({ categories: [...ticketSettings.categories, buildDefaultTicketCategory()] })}
            >
              <Plus className="mr-2 size-4" />
              {dictionary.ticketSettings.addCategory}
            </Button>
          </div>

          {ticketSettings.categories.length ? ticketSettings.categories.map((category, categoryIndex) => (
            <div key={category.id} className="space-y-4 rounded-2xl border border-border/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h5 className="font-medium">{dictionary.ticketSettings.categoryLabel} {categoryIndex + 1}</h5>
                  <p className="text-sm text-muted-foreground">ID: {category.id}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => patchTicketSettings({ categories: ticketSettings.categories.filter((item) => item.id !== category.id) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label>{dictionary.ticketSettings.buttonText}</Label>
                  <Input
                    value={category.label ?? ""}
                    onChange={(event) => patchTicketCategory(category.id, { label: event.target.value })}
                    placeholder={dictionary.ticketSettings.buttonTextPlaceholder}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{dictionary.ticketSettings.emoji}</Label>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                    <DiscordEntitySelect
                      value={emojiOptions.some((option) => option.id === category.emoji) ? category.emoji : undefined}
                      onChange={(value) => patchTicketCategory(category.id, { emoji: value ?? "" })}
                      options={emojiOptions}
                      placeholder={dictionary.ticketSettings.pickServerEmoji}
                    />
                    <Input
                      value={category.emoji ?? ""}
                      onChange={(event) => patchTicketCategory(category.id, { emoji: event.target.value })}
                      placeholder={dictionary.ticketSettings.typeAnyEmoji}
                      maxLength={100}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{dictionary.ticketSettings.categoryDescription}</Label>
                <Textarea
                  value={category.description ?? ""}
                  onChange={(event) => patchTicketCategory(category.id, { description: event.target.value })}
                  placeholder={dictionary.ticketSettings.categoryDescriptionPlaceholder}
                  maxLength={240}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>{dictionary.ticketSettings.supportRoles}</Label>
                <DiscordMultiEntitySelect
                  value={category.supportRoleIds}
                  onChange={(value) => patchTicketCategory(category.id, { supportRoleIds: value })}
                  options={roles}
                  placeholder={dictionary.ticketSettings.supportRoles}
                />
              </div>

              <div className="space-y-3 rounded-xl bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h6 className="font-medium">{dictionary.ticketSettings.modalQuestions}</h6>
                    <p className="text-sm text-muted-foreground">{dictionary.ticketSettings.modalQuestionsDescription}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={category.modalQuestions.length >= 5}
                    onClick={() => patchTicketCategory(category.id, {
                      modalQuestions: [...category.modalQuestions, buildDefaultTicketQuestion()],
                    })}
                  >
                    <Plus className="mr-2 size-4" />
                    {dictionary.ticketSettings.addQuestion}
                  </Button>
                </div>

                {category.modalQuestions.length ? category.modalQuestions.map((question, questionIndex) => (
                  <div key={question.id} className="space-y-3 rounded-xl border border-border/50 bg-background p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-medium">{dictionary.ticketSettings.questionLabel} {questionIndex + 1}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => patchTicketCategory(category.id, {
                          modalQuestions: category.modalQuestions.filter((item) => item.id !== question.id),
                        })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{dictionary.ticketSettings.questionText}</Label>
                        <Input
                          value={question.label}
                          onChange={(event) => patchTicketQuestion(category.id, question.id, { label: event.target.value })}
                          maxLength={45}
                          placeholder={dictionary.ticketSettings.questionTextPlaceholder}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{dictionary.ticketSettings.inputStyle}</Label>
                        <Select
                          value={question.style}
                          onValueChange={(value) => patchTicketQuestion(category.id, question.id, { style: value as TicketModalQuestion["style"] })}
                        >
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="short">{dictionary.ticketSettings.shortInput}</SelectItem>
                            <SelectItem value="paragraph">{dictionary.ticketSettings.paragraphInput}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{dictionary.ticketSettings.placeholder}</Label>
                      <Input
                        value={question.placeholder ?? ""}
                        onChange={(event) => patchTicketQuestion(category.id, question.id, { placeholder: event.target.value })}
                        maxLength={100}
                        placeholder={dictionary.ticketSettings.placeholder}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2">
                      <Label htmlFor={`${category.id}-${question.id}-required`}>{dictionary.ticketSettings.required}</Label>
                      <Switch
                        id={`${category.id}-${question.id}-required`}
                        checked={question.required}
                        onCheckedChange={(checked) => patchTicketQuestion(category.id, question.id, { required: checked })}
                      />
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">{dictionary.ticketSettings.noQuestions}</p>
                )}
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              {dictionary.ticketSettings.noCategories}
            </div>
          )}
        </div>

        <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
          {dictionary.serverSettings.saveDiscordSettings}
        </Button>
      </CardContent>
    </Card>
  );
}
