"use client";

import { useMemo, useState, useTransition } from "react";
import { Link2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/i18n/dictionaries";

export function AutoLinkPlatformIdsButton({
  serverId,
  dictionary,
}: {
  serverId: string;
  dictionary: Dictionary;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [clanTag, setClanTag] = useState("");
  const [isPending, startTransition] = useTransition();

  const normalizedClanTag = useMemo(() => clanTag.trim(), [clanTag]);

  function handleSubmit() {
    startTransition(async () => {
      const response = await fetch(`/api/servers/${serverId}/users/auto-link-platform-ids`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clanTag: normalizedClanTag,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? dictionary.common.error);
        return;
      }

      toast.success(
        dictionary.userManagement.autoLinkPlatformIdsSuccess
          .replace("{linked}", String(body.linkedUsers ?? 0))
          .replace("{players}", String(body.matchedPlayers ?? 0)),
      );

      if ((body.ambiguousUsers ?? 0) > 0 || (body.conflictedUsers ?? 0) > 0 || (body.failedEvents ?? 0) > 0) {
        toast.error(
          dictionary.userManagement.autoLinkPlatformIdsPartial
            .replace("{ambiguous}", String(body.ambiguousUsers ?? 0))
            .replace("{conflicts}", String(body.conflictedUsers ?? 0))
            .replace("{failed}", String(body.failedEvents ?? 0)),
        );
      }

      setIsOpen(false);
      setClanTag("");
      router.refresh();
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          <Link2 className="size-4" />
          {dictionary.userManagement.autoLinkPlatformIds}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{dictionary.userManagement.autoLinkPlatformIds}</DialogTitle>
          <DialogDescription>{dictionary.userManagement.autoLinkPlatformIdsDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="clan-tag">{dictionary.userManagement.clanTag}</Label>
          <Input
            id="clan-tag"
            value={clanTag}
            onChange={(event) => setClanTag(event.target.value)}
            placeholder={dictionary.userManagement.clanTagPlaceholder}
            className="rounded-xl"
          />
          <p className="text-sm text-muted-foreground">{dictionary.userManagement.autoLinkPlatformIdsHint}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsOpen(false)} disabled={isPending}>
            {dictionary.common.cancel}
          </Button>
          <Button type="button" className="rounded-xl" onClick={handleSubmit} disabled={isPending || !normalizedClanTag}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            {dictionary.userManagement.autoLinkPlatformIds}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
