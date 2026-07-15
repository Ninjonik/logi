"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleHelp, Gamepad2 } from "lucide-react";
import { toast } from "sonner";

import { AvatarPicker } from "@/components/app/avatar-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatPlatformIds } from "@/lib/platform-ids";
import type { AppUser } from "@/types/domain";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{label}</div>
      <Input value={value} readOnly className="rounded-xl" />
    </div>
  );
}

export function UserSettingsForm({
  user,
  dictionary,
}: {
  user: AppUser;
  dictionary: Dictionary;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [avatar, setAvatar] = useState(user.avatar);
  const [platformIds, setPlatformIds] = useState(formatPlatformIds(user.platformIds));

  async function handleSave() {
    const response = await fetch("/api/user/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatar, platformIds }),
    });
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.error ?? dictionary.common.error);
      return;
    }

    toast.success(dictionary.common.save);
    startTransition(() => router.refresh());
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
      <Card className="rounded-2xl border-border/60">
        <CardHeader>
          <CardTitle>{dictionary.userSettings.profile}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <AvatarPicker
              value={avatar}
              onChange={setAvatar}
              fallback={user.name.slice(0, 2)}
              label={dictionary.userSettings.avatar}
              buttonLabel={dictionary.common.upload}
              disabled={isPending}
            />
          </div>
          <Field label={dictionary.userSettings.discordName} value={user.name} />
          <Field label={dictionary.userSettings.discordId} value={user.discordId} />
          <Field label={dictionary.userSettings.preferredLanguage} value={dictionary.userSettings.english} />
          <Field label={dictionary.userSettings.streamerMode} value={user.isStreamer ? dictionary.userSettings.enabled : dictionary.userSettings.disabled} />
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">{dictionary.userSettings.platformId}</div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground">
                    <CircleHelp className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm space-y-2">
                  <p>{dictionary.userSettings.platformIdHelp}</p>
                  <div className="space-y-1 text-xs">
                    <p>
                      <a href="https://help.steampowered.com/en/faqs/view/2816-BE67-5B69-0FEC" target="_blank" rel="noreferrer" className="underline">
                        {dictionary.userSettings.platformIdSteamLink}
                      </a>
                      {" "}
                      {dictionary.userSettings.platformIdSteamHint}
                    </p>
                    <p>
                      <a href="https://www.epicgames.com/help/c-202300000001645/c-Trending_0/what-is-an-epic-games-account-id-and-where-can-i-find-it-a202300000011535" target="_blank" rel="noreferrer" className="underline">
                        {dictionary.userSettings.platformIdEpicLink}
                      </a>
                      {" "}
                      {dictionary.userSettings.platformIdEpicHint}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              value={platformIds}
              onChange={(event) => setPlatformIds(event.target.value)}
              placeholder={dictionary.userSettings.platformIdPlaceholder}
              className="rounded-xl"
            />
          </div>
          <div className="md:col-span-2">
            <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
              {dictionary.common.save}
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-6">
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="size-4" />
              {dictionary.userSettings.platformConnection}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge variant={user.platformIds.length ? "default" : "secondary"} className="rounded-full px-3">
              {user.platformIds.length ? dictionary.userSettings.platformConnected : dictionary.userSettings.platformDisconnected}
            </Badge>
            <div className="rounded-2xl border border-border/60 p-4">
              <div className="text-sm text-muted-foreground">{dictionary.userSettings.currentPlatformId}</div>
              <div className="mt-2 break-all font-medium">{formatPlatformIds(user.platformIds) || dictionary.shared.notSet}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
