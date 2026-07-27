"use client";

import { useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import type { z } from "zod";
import { toast } from "sonner";

import { DiscordEntitySelect, type DiscordSelectOption } from "@/components/app/discord-entity-select";
import { EmojiPickerInput } from "@/components/app/emoji-picker-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/i18n/dictionaries";
import { groupSchema, type GroupInput } from "@/lib/validation/group";
import type { Group } from "@/types/domain";

type DiscordMetadata = {
  roles: DiscordSelectOption[];
  emojis: Array<DiscordSelectOption & { value?: string }>;
};

export function GroupForm({
  serverId,
  locale,
  dictionary,
  group,
  canEdit = false,
  createMode = false,
  availableGroups = [],
}: {
  serverId: string;
  locale: string;
  dictionary: Dictionary;
  group?: Group;
  canEdit?: boolean;
  createMode?: boolean;
  availableGroups?: Group[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [metadata, setMetadata] = useState<DiscordMetadata | null>(null);
  const form = useForm<z.input<typeof groupSchema>, unknown, GroupInput>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: group?.name ?? "",
      color: group?.color ?? "#64748b",
      order: group?.order ?? 0,
      parentId: group?.parentId ?? undefined,
      description: group?.description ?? "",
      discordRoleId: group?.discordRoleId ?? "",
      discordEmoji: group?.discordEmoji ?? "",
    },
  });

  useEffect(() => {
    if (!canEdit) {
      setMetadata(null);
      return;
    }

    fetch(`/api/servers/${serverId}/discord-metadata`)
      .then((response) => response.json())
      .then((body) => setMetadata(body))
      .catch(() => setMetadata(null));
  }, [canEdit, serverId]);

  const filteredParentGroups = availableGroups.filter(
    (g) => g.id !== group?.id && !g.parentId,
  );

  async function submit(values: GroupInput) {
    const finalValues = {
      ...values,
      parentId: values.parentId === "none" ? undefined : values.parentId,
    };

    const response = await fetch(
      createMode ? `/api/servers/${serverId}/groups` : `/api/servers/${serverId}/groups/${group?.id}`,
      {
        method: createMode ? "POST" : "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(finalValues),
      },
    );

    const body = await response.json();
    if (!response.ok) {
      form.setError("root", {
        message: body.error ?? "Unable to save group.",
      });
      toast.error(body.error ?? "Unable to save group.");
      return;
    }

    toast.success(createMode ? dictionary.groups.createTitle : dictionary.common.save);

    startTransition(() => {
      router.push(`/${locale}/dashboard/servers/${serverId}/groups${createMode ? `/${body.groupId}` : ""}`);
      router.refresh();
    });
  }

  async function removeGroup() {
    if (!group) return;
    const response = await fetch(`/api/servers/${serverId}/groups/${group.id}`, {
      method: "DELETE",
    });
    const body = await response.json();
    if (!response.ok) {
      form.setError("root", {
        message: body.error ?? "Unable to delete group.",
      });
      toast.error(body.error ?? "Unable to delete group.");
      return;
    }

    toast.success(dictionary.common.clear);

    startTransition(() => {
      router.push(`/${locale}/dashboard/servers/${serverId}/groups`);
      router.refresh();
    });
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>{createMode ? dictionary.groups.createTitle : group?.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
          <div className="grid gap-4 md:grid-cols-[1fr_112px_112px]">
            <div className="space-y-2">
              <Label>{dictionary.groups.name}</Label>
              <Input {...form.register("name")} className="rounded-xl" disabled={!canEdit} />
              {form.formState.errors.name ? <p className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>{dictionary.groups.order}</Label>
              <Input type="number" {...form.register("order", { valueAsNumber: true })} className="rounded-xl" disabled={!canEdit} />
              {form.formState.errors.order ? <p className="text-sm text-destructive">{form.formState.errors.order.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>{dictionary.groups.color}</Label>
              <Input type="color" {...form.register("color")} className="h-11 rounded-xl p-1" disabled={!canEdit} />
              {form.formState.errors.color ? <p className="text-sm text-destructive">{form.formState.errors.color.message}</p> : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{dictionary.groups.parent}</Label>
            <Controller
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? "none"} disabled={!canEdit}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={dictionary.groups.none} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{dictionary.groups.none}</SelectItem>
                    {filteredParentGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>{dictionary.groups.descriptionLabel}</Label>
            <Textarea {...form.register("description")} className="min-h-28 rounded-xl" disabled={!canEdit} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{dictionary.serverSettings.requiredRoleId}</Label>
              <Controller
                control={form.control}
                name="discordRoleId"
                render={({ field }) => (
                  <DiscordEntitySelect
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "")}
                    options={metadata?.roles ?? []}
                    placeholder={dictionary.serverSettings.requiredRoleId}
                    noneLabel={dictionary.serverSettings.noGroupRole}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>{dictionary.serverSettings.groupEmoji}</Label>
              <Controller
                control={form.control}
                name="discordEmoji"
                render={({ field }) => (
                  <EmojiPickerInput
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "")}
                    customEmojis={(metadata?.emojis ?? []).map((emoji) => ({
                      id: emoji.id,
                      name: emoji.name,
                      imageUrl: emoji.imageUrl,
                    }))}
                    placeholder={dictionary.serverSettings.groupEmoji}
                    labels={dictionary.emojiPicker}
                    noneLabel={dictionary.groups.none}
                  />
                )}
              />
            </div>
          </div>
          {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button className="rounded-xl" type="submit" disabled={!canEdit || isPending || form.formState.isSubmitting}>
              {dictionary.common.save}
            </Button>
            {group && canEdit ? (
              <Button
                type="button"
                variant="destructive"
                className="rounded-xl"
                onClick={removeGroup}
                disabled={isPending || form.formState.isSubmitting}
              >
                {dictionary.common.clear}
              </Button>
            ) : null}
            {!canEdit ? <p className="self-center text-sm text-muted-foreground">{dictionary.common.adminOnly}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
