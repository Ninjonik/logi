"use client";

import type React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Dictionary } from "@/i18n/dictionaries";
import { supportedTimezones } from "@/lib/discord-timezones";
import { discordSettingsSchema, type DiscordSettingsInput } from "@/lib/validation/discord-settings";
import type { DiscordConfig, Group } from "@/types/domain";

export function DiscordSettingsForm({
  serverId,
  dictionary,
  groups,
  config,
}: {
  serverId: string;
  dictionary: Dictionary;
  groups: Group[];
  config: DiscordConfig | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<DiscordSettingsInput>({
    resolver: zodResolver(discordSettingsSchema),
    defaultValues: {
      timezone: (config?.timezone as (typeof supportedTimezones)[number]) ?? "UTC",
      announcementsChannelId: config?.announcementsChannelId ?? "",
      forumChannelId: config?.forumChannelId ?? "",
      clanRoleId: config?.clanRoleId ?? "",
      dashboardAdminRoleId: config?.dashboardAdminRoleId ?? "",
      groupLinks: groups.map((group) => {
        const existing = config?.groupLinks.find((link) => link.groupId === group.id);
        return {
          groupId: group.id,
          roleId: existing?.roleId ?? "",
          emoji: existing?.emoji ?? "",
        };
      }),
    },
  });

  const groupLinks = form.watch("groupLinks");

  async function onSubmit(values: DiscordSettingsInput) {
    const response = await fetch(`/api/servers/${serverId}/discord-settings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(values),
    });

    const body = await response.json();
    if (!response.ok) {
      toast.error(body.error ?? dictionary.serverSettings.discordSettingsSaveError);
      return;
    }

    toast.success(dictionary.serverSettings.discordSettingsSaved);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>{dictionary.serverSettings.discordTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">{dictionary.serverSettings.discordDescription}</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{dictionary.serverSettings.timezone}</Label>
              <Select value={form.watch("timezone")} onValueChange={(value) => form.setValue("timezone", value as DiscordSettingsInput["timezone"], { shouldValidate: true })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedTimezones.map((timezone) => (
                    <SelectItem key={timezone} value={timezone}>
                      {timezone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Field label={dictionary.serverSettings.announcementsChannelId} error={form.formState.errors.announcementsChannelId?.message}>
              <Input {...form.register("announcementsChannelId")} className="rounded-xl" />
            </Field>

            <Field label={dictionary.serverSettings.forumChannelId} error={form.formState.errors.forumChannelId?.message}>
              <Input {...form.register("forumChannelId")} className="rounded-xl" />
            </Field>

            <Field label={dictionary.serverSettings.clanRoleId} error={form.formState.errors.clanRoleId?.message}>
              <Input {...form.register("clanRoleId")} className="rounded-xl" />
            </Field>

            <Field label={dictionary.serverSettings.dashboardAdminRoleId} error={form.formState.errors.dashboardAdminRoleId?.message}>
              <Input {...form.register("dashboardAdminRoleId")} className="rounded-xl" />
            </Field>
          </div>

          <div className="space-y-3">
            <div className="font-medium">{dictionary.serverSettings.groupRoleMappings}</div>
            <div className="grid gap-3">
              {groups.map((group, index) => (
                <div key={group.id} className="grid gap-3 rounded-2xl border border-border/60 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px]">
                  <div className="flex items-center gap-3">
                    <span className="size-3 rounded-full border border-border/60" style={{ backgroundColor: group.color }} />
                    <span className="font-medium">{group.name}</span>
                  </div>
                  <Field label={dictionary.serverSettings.requiredRoleId} error={form.formState.errors.groupLinks?.[index]?.roleId?.message}>
                    <Input
                      value={groupLinks[index]?.roleId ?? ""}
                      onChange={(event) => form.setValue(`groupLinks.${index}.roleId`, event.target.value, { shouldValidate: true })}
                      className="rounded-xl"
                    />
                  </Field>
                  <Field label={dictionary.serverSettings.groupEmoji} error={form.formState.errors.groupLinks?.[index]?.emoji?.message}>
                    <Input
                      value={groupLinks[index]?.emoji ?? ""}
                      onChange={(event) => form.setValue(`groupLinks.${index}.emoji`, event.target.value, { shouldValidate: true })}
                      className="rounded-xl"
                    />
                  </Field>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{dictionary.serverSettings.botRequiredNotice}</p>

          <Button className="rounded-xl" type="submit" disabled={isPending || form.formState.isSubmitting}>
            {dictionary.serverSettings.saveDiscordSettings}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
