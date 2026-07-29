"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AvatarPicker } from "@/components/app/avatar-picker";
import type { DiscordSelectOption } from "@/components/app/discord-entity-select";
import { EmojiPickerInput } from "@/components/app/emoji-picker-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import type { EventCategory, Guild } from "@/types/domain";

type EditableEventCategory = EventCategory & { id: string; emoji: string };
type DiscordMetadata = { emojis: DiscordSelectOption[] };

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildDefaultCategory(): EditableEventCategory {
  return {
    id: makeId("event-category"),
    label: "",
    color: "#6b7280",
    emoji: "",
  };
}

function toEditableCategories(categories: Guild["eventCategories"]): EditableEventCategory[] {
  return (categories ?? []).map((category) => ({
    ...category,
    emoji: category.emoji ?? "",
  }));
}

export function ServerFrontendSettingsForm({
  server,
  dictionary,
  guildLoginUrl,
}: {
  server: Guild;
  dictionary: Dictionary;
  guildLoginUrl: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(server.name);
  const [avatar, setAvatar] = useState(server.avatar);
  const [description, setDescription] = useState(server.description ?? "");
  const [eventCategories, setEventCategories] = useState<EditableEventCategory[]>(
    toEditableCategories(server.eventCategories),
  );
  const [metadata, setMetadata] = useState<DiscordMetadata | null>(null);

  useEffect(() => {
    fetch(`/api/servers/${server.id}/discord-metadata`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body || !Array.isArray(body.emojis)) {
          throw new Error("Unable to load Discord metadata.");
        }
        setMetadata({ emojis: body.emojis });
      })
      .catch(() => setMetadata(null));
  }, [server.id]);

  function patchCategory(categoryId: string, patch: Partial<EditableEventCategory>) {
    setEventCategories((current) => current.map((category) => (
      category.id === categoryId ? { ...category, ...patch } : category
    )));
  }

  async function handleSave() {
    const response = await fetch(`/api/servers/${server.id}/frontend-settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        avatar,
        description,
        eventCategories: eventCategories.map((category) => ({
          id: category.id,
          label: category.label,
          color: category.color,
          emoji: category.emoji || undefined,
        })),
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.error ?? dictionary.common.error);
      return;
    }

    toast.success(dictionary.common.save);
    startTransition(() => router.refresh());
  }

  async function handleCopyLoginUrl() {
    await navigator.clipboard.writeText(guildLoginUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>{dictionary.serverSettings.clanName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>{dictionary.serverSettings.clanName}</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <AvatarPicker
            value={avatar}
            onChange={setAvatar}
            fallback={name.slice(0, 2) || "CL"}
            label={dictionary.userSettings.avatar}
            buttonLabel={dictionary.common.upload}
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label>{dictionary.event.fields.description}</Label>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-28 rounded-xl" />
        </div>

        <div className="space-y-4 rounded-2xl border border-border/60 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">{dictionary.serverSettings.eventCategoriesTitle}</h3>
              <p className="text-sm text-muted-foreground">{dictionary.serverSettings.eventCategoriesDescription}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setEventCategories((current) => [...current, buildDefaultCategory()])}
            >
              <Plus className="mr-2 size-4" />
              {dictionary.serverSettings.addEventCategory}
            </Button>
          </div>

          {eventCategories.length ? eventCategories.map((category, index) => (
            <div key={category.id} className="space-y-4 rounded-2xl border border-border/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-medium">{dictionary.serverSettings.eventCategoryLabel} {index + 1}</h4>
                  <p className="text-xs text-muted-foreground">ID: {category.id}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setEventCategories((current) => current.filter((item) => item.id !== category.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{dictionary.serverSettings.eventCategoryName}</Label>
                  <Input
                    value={category.label}
                    onChange={(event) => patchCategory(category.id, { label: event.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{dictionary.ticketSettings.emoji}</Label>
                  <EmojiPickerInput
                    value={category.emoji}
                    onChange={(value) => patchCategory(category.id, { emoji: value ?? "" })}
                    customEmojis={metadata?.emojis ?? []}
                    placeholder={dictionary.emojiPicker.pickEmoji}
                    labels={dictionary.emojiPicker}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{dictionary.groups.color}</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={category.color}
                    onChange={(event) => patchCategory(category.id, { color: event.target.value })}
                    className="h-11 w-16 rounded-xl p-1"
                  />
                  <Input
                    value={category.color}
                    onChange={(event) => patchCategory(category.id, { color: event.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-border/60 px-4 py-5 text-sm text-muted-foreground">
              {dictionary.serverSettings.noEventCategories}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>{dictionary.serverSettings.guildLoginUrl}</Label>
          <div className="flex gap-2">
            <Input value={guildLoginUrl} readOnly disabled className="rounded-xl disabled:cursor-text disabled:opacity-100" />
            <Button type="button" variant="outline" className="shrink-0 rounded-xl" onClick={handleCopyLoginUrl}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? dictionary.serverSettings.copiedLoginUrl : dictionary.serverSettings.copyLoginUrl}
            </Button>
          </div>
        </div>
        <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
          {dictionary.common.save}
        </Button>
      </CardContent>
    </Card>
  );
}
