"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Guild } from "@/types/domain";

export function ServerFrontendSettingsForm({
  server,
  dictionary,
}: {
  server: Guild;
  dictionary: Dictionary;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(server.name);
  const [avatar, setAvatar] = useState(server.avatar);
  const [description, setDescription] = useState(server.description ?? "");

  async function handleSave() {
    const response = await fetch(`/api/servers/${server.id}/frontend-settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, avatar, description }),
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
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>{dictionary.serverSettings.clanName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{dictionary.serverSettings.clanName}</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>{dictionary.userSettings.avatarUrl}</Label>
          <Input value={avatar} onChange={(event) => setAvatar(event.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>{dictionary.event.fields.description}</Label>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-28 rounded-xl" />
        </div>
        <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
          {dictionary.common.save}
        </Button>
      </CardContent>
    </Card>
  );
}
