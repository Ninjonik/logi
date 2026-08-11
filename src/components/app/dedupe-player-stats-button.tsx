"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
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
import type { Dictionary } from "@/i18n/dictionaries";

export function DedupePlayerStatsButton({
  serverId,
  dictionary,
}: {
  serverId: string;
  dictionary: Dictionary;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const response = await fetch(`/api/servers/${serverId}/users/dedupe-player-stats`, {
        method: "POST",
      });

      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? dictionary.common.error);
        return;
      }

      toast.success(
        dictionary.userManagement.dedupePlayerStatsSuccess
          .replace("{matches}", String(body.duplicateMatchesRemoved ?? 0))
          .replace("{users}", String(body.affectedUserIds?.length ?? 0)),
      );

      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          <Sparkles className="size-4" />
          {dictionary.userManagement.dedupePlayerStats}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{dictionary.userManagement.dedupePlayerStats}</DialogTitle>
          <DialogDescription>{dictionary.userManagement.dedupePlayerStatsDescription}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{dictionary.userManagement.dedupePlayerStatsHint}</p>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsOpen(false)} disabled={isPending}>
            {dictionary.common.cancel}
          </Button>
          <Button type="button" className="rounded-xl" onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {dictionary.userManagement.dedupePlayerStats}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
