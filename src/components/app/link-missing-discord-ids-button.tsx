"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DiscordEntitySelect, type DiscordSelectOption } from "@/components/app/discord-entity-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/i18n/dictionaries";

type DiscordMetadata = {
  roles: DiscordSelectOption[];
};

export function LinkMissingDiscordIdsButton({
  serverId,
  dictionary,
  defaultRoleId,
}: {
  serverId: string;
  dictionary: Dictionary;
  defaultRoleId?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [metadata, setMetadata] = useState<DiscordMetadata | null>(null);
  const [roleId, setRoleId] = useState(defaultRoleId ?? "");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    fetch(`/api/servers/${serverId}/discord-metadata`)
      .then((response) => response.json())
      .then((body) => setMetadata({ roles: body.roles ?? [] }))
      .catch(() => setMetadata({ roles: [] }));
  }, [isOpen, serverId]);

  function handleSubmit() {
    startTransition(async () => {
      const response = await fetch(`/api/servers/${serverId}/users/link-missing-discord-ids`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleId }),
      });

      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? dictionary.common.error);
        return;
      }

      toast.success(
        dictionary.userManagement.linkMissingDiscordIdsSuccess
          .replace("{linked}", String(body.linkedUsers ?? 0))
          .replace("{scanned}", String(body.scannedUsers ?? 0)),
      );

      if ((body.mergedUsers ?? 0) > 0) {
        toast.success(
          dictionary.userManagement.linkMissingDiscordIdsMerged
            .replace("{count}", String(body.mergedUsers ?? 0)),
        );
      }

      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          <Link2 className="size-4" />
          {dictionary.userManagement.linkMissingDiscordIds}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{dictionary.userManagement.linkMissingDiscordIds}</DialogTitle>
          <DialogDescription>{dictionary.userManagement.linkMissingDiscordIdsDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>{dictionary.userManagement.discordSourceRole}</Label>
          <DiscordEntitySelect
            value={roleId}
            onChange={(value) => setRoleId(value ?? "")}
            options={metadata?.roles ?? []}
            placeholder={dictionary.userManagement.discordSourceRole}
            allowNone={false}
          />
          <p className="text-sm text-muted-foreground">{dictionary.userManagement.linkMissingDiscordIdsHint}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsOpen(false)} disabled={isPending}>
            {dictionary.common.cancel}
          </Button>
          <Button type="button" className="rounded-xl" onClick={handleSubmit} disabled={isPending || !roleId}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            {dictionary.userManagement.linkMissingDiscordIds}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
