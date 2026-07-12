"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Gamepad2, Link2 } from "lucide-react";
import { toast } from "sonner";

import { AvatarPicker } from "@/components/app/avatar-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Dictionary } from "@/i18n/dictionaries";
import type { AppUser } from "@/types/domain";
import type { SteamProfile } from "@/lib/steam";

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
  steamProfile,
}: {
  user: AppUser;
  dictionary: Dictionary;
  steamProfile: SteamProfile | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [avatar, setAvatar] = useState(user.avatar);

  async function handleSave() {
    const response = await fetch("/api/user/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatar }),
    });
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.error ?? dictionary.common.error);
      return;
    }

    toast.success(dictionary.common.save);
    startTransition(() => router.refresh());
  }

  async function handleUnlinkSteam() {
    const response = await fetch("/api/user/steam/unlink", {
      method: "POST",
    });
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.error ?? dictionary.common.error);
      return;
    }

    toast.success(dictionary.userSettings.unlinkSteam);
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
          <Field label={dictionary.userSettings.discordId} value={user.id} />
          <Field label={dictionary.userSettings.preferredLanguage} value={dictionary.userSettings.english} />
          <Field label={dictionary.userSettings.streamerMode} value={user.isStreamer ? dictionary.userSettings.enabled : dictionary.userSettings.disabled} />
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
              {dictionary.userSettings.steamConnection}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge variant={user.steamId ? "default" : "secondary"} className="rounded-full px-3">
              {user.steamId ? dictionary.userSettings.steamConnected : dictionary.userSettings.steamDisconnected}
            </Badge>
            {steamProfile ? (
              <a
                href={steamProfile.profileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-border/60 p-3 transition-colors hover:bg-accent/40"
              >
                <img src={steamProfile.avatar} alt={steamProfile.name} className="size-14 rounded-xl object-cover" />
                <div>
                  <div className="font-medium">{steamProfile.name}</div>
                  <div className="text-sm text-muted-foreground">{dictionary.userSettings.steamConnected}</div>
                </div>
              </a>
            ) : null}
            {!user.steamId ? (
              <Button asChild className="w-full rounded-xl">
                <a href="/api/steam/link">
                  <Link2 className="size-4" />
                  {dictionary.userSettings.connectSteam}
                </a>
              </Button>
            ) : null}
            {user.steamId ? (
              <Button variant="outline" className="w-full rounded-xl" onClick={handleUnlinkSteam} disabled={isPending}>
                <Link2 className="size-4" />
                {dictionary.userSettings.unlinkSteam}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
