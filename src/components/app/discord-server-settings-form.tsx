"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DiscordEntitySelect, type DiscordSelectOption } from "@/components/app/discord-entity-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Dictionary } from "@/i18n/dictionaries";
import { supportedTimezones } from "@/lib/discord-timezones";
import type { DiscordConfig } from "@/types/domain";

type DiscordMetadata = {
  roles: DiscordSelectOption[];
  channels: Array<DiscordSelectOption & { type: number; parentId?: string }>;
  emojis: DiscordSelectOption[];
};

export function DiscordServerSettingsForm({
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
  const [timezone, setTimezone] = useState(config?.timezone ?? "UTC");
  const [announcementsChannelId, setAnnouncementsChannelId] = useState<string | undefined>(config?.announcementsChannelId);
  const [forumCategoryId, setForumCategoryId] = useState<string | undefined>(config?.forumCategoryId);
  const [clanRoleId, setClanRoleId] = useState<string | undefined>(config?.clanRoleId);
  const [dashboardAdminRoleId, setDashboardAdminRoleId] = useState<string | undefined>(config?.dashboardAdminRoleId);

  useEffect(() => {
    fetch(`/api/servers/${serverId}/discord-metadata`)
      .then((response) => response.json())
      .then((body) => setMetadata(body))
      .catch(() => setMetadata(null));
  }, [serverId]);

  async function handleSave() {
    const response = await fetch(`/api/servers/${serverId}/discord-settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        timezone,
        announcementsChannelId,
        forumCategoryId,
        clanRoleId,
        dashboardAdminRoleId,
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

  const announcementChannels = metadata?.channels.filter((channel) => channel.type === 0 || channel.type === 5) ?? [];
  const categoryChannels = metadata?.channels.filter((channel) => channel.type === 4) ?? [];
  const roles = metadata?.roles ?? [];

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>{dictionary.serverSettings.discordTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{dictionary.serverSettings.timezone}</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedTimezones.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{dictionary.serverSettings.announcementsChannelId}</Label>
          <DiscordEntitySelect value={announcementsChannelId} onChange={setAnnouncementsChannelId} options={announcementChannels} placeholder={dictionary.serverSettings.announcementsChannelId} />
        </div>
        <div className="space-y-2">
          <Label>{dictionary.serverSettings.forumCategoryId}</Label>
          <DiscordEntitySelect value={forumCategoryId} onChange={setForumCategoryId} options={categoryChannels} placeholder={dictionary.serverSettings.forumCategoryId} />
        </div>
        <div className="space-y-2">
          <Label>{dictionary.serverSettings.clanRoleId}</Label>
          <DiscordEntitySelect value={clanRoleId} onChange={setClanRoleId} options={roles} placeholder={dictionary.serverSettings.clanRoleId} />
        </div>
        <div className="space-y-2">
          <Label>{dictionary.serverSettings.dashboardAdminRoleId}</Label>
          <DiscordEntitySelect value={dashboardAdminRoleId} onChange={setDashboardAdminRoleId} options={roles} placeholder={dictionary.serverSettings.dashboardAdminRoleId} />
        </div>
        <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
          {dictionary.serverSettings.saveDiscordSettings}
        </Button>
      </CardContent>
    </Card>
  );
}
