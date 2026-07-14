"use client";

import { useState, useTransition } from "react";
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

export function SubmitMatchResultsButton({
  serverId,
  eventId,
  dictionary,
}: {
  serverId: string;
  eventId: string;
  dictionary: Dictionary;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [matchLink, setMatchLink] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const response = await fetch(`/api/servers/${serverId}/events/${eventId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "submitMatchResults",
          matchLink,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? dictionary.common.error);
        return;
      }

      toast.success(dictionary.event.matchResultsImported
        .replace("{players}", String(body.importedPlayers))
        .replace("{result}", body.eventResultSaved ? dictionary.event.resultSaved : dictionary.event.resultSkipped));
      setIsOpen(false);
      setMatchLink("");
      router.refresh();
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          <Link2 className="size-4" />
          {dictionary.event.submitMatchResults}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{dictionary.event.submitMatchResults}</DialogTitle>
          <DialogDescription>{dictionary.event.submitMatchResultsDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="match-link">{dictionary.event.matchLink}</Label>
          <Input
            id="match-link"
            value={matchLink}
            onChange={(event) => setMatchLink(event.target.value)}
            placeholder="https://event.hllserver.app/games/xxxx"
            className="rounded-xl"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsOpen(false)} disabled={isPending}>
            {dictionary.common.cancel}
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            onClick={handleSubmit}
            disabled={isPending || !matchLink.trim()}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            {dictionary.event.submitMatchResults}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
