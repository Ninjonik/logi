"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";

function normalizeLinks(value: string) {
  return value
    .split(/[\n,]+/g)
    .map((entry) => entry.trim().replace(/\s+/g, ""))
    .filter(Boolean)
    .join("\n");
}

export function ImportEventsButton({
  serverId,
  dictionary,
}: {
  serverId: string;
  dictionary: Dictionary;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [links, setLinks] = useState("");
  const [importPlayers, setImportPlayers] = useState(false);
  const [clanTag, setClanTag] = useState("");
  const [isPending, startTransition] = useTransition();

  const normalizedLinks = useMemo(() => normalizeLinks(links), [links]);
  const normalizedClanTag = useMemo(() => clanTag.trim(), [clanTag]);
  const linkCount = normalizedLinks ? normalizedLinks.split("\n").length : 0;

  function handleSubmit() {
    startTransition(async () => {
      const response = await fetch(`/api/servers/${serverId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "importEvents",
          links: normalizedLinks,
          importPlayers,
          clanTag: importPlayers ? normalizedClanTag : undefined,
        }),
      });

      const body = await response.json();
      console.log("[import-events] response", body);
      if (!response.ok) {
        toast.error(body.error ?? dictionary.common.error);
        return;
      }

      toast.success(
        dictionary.event.importEventsSuccess
          .replace("{events}", String(body.importedEvents ?? 0))
          .replace("{players}", String(body.importedPlayers ?? 0)),
      );

      if (Array.isArray(body.failedLinks) && body.failedLinks.length > 0) {
        toast.error(
          dictionary.event.importEventsPartial
            .replace("{failed}", String(body.failedLinks.length)),
        );
      }

      setIsOpen(false);
      setLinks("");
      setImportPlayers(false);
      setClanTag("");
      router.refresh();
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          <Download className="size-4" />
          {dictionary.event.importEvents}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{dictionary.event.importEvents}</DialogTitle>
          <DialogDescription>{dictionary.event.importEventsDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="event-links">{dictionary.event.matchLinks}</Label>
          <Textarea
            id="event-links"
            value={links}
            onChange={(event) => setLinks(event.target.value)}
            placeholder={"https://event.hllserver.app/games/xxxx\nhttps://event.hllserver.app/games/yyyy"}
            className="h-64 resize-none overflow-y-auto rounded-xl"
          />
          <p className="text-sm text-muted-foreground">
            {dictionary.event.importEventsHint.replace("{count}", String(linkCount))}
          </p>
        </div>
        <div className="space-y-3 rounded-xl border border-border/60 p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="import-event-players"
              checked={importPlayers}
              onCheckedChange={(checked) => setImportPlayers(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="import-event-players">{dictionary.event.importEventPlayers}</Label>
              <p className="text-sm text-muted-foreground">{dictionary.event.importEventPlayersDescription}</p>
            </div>
          </div>
          {importPlayers ? (
            <div className="space-y-2">
              <Label htmlFor="event-import-clan-tag">{dictionary.userManagement.clanTag}</Label>
              <Input
                id="event-import-clan-tag"
                value={clanTag}
                onChange={(event) => setClanTag(event.target.value)}
                placeholder={dictionary.userManagement.clanTagPlaceholder}
                className="rounded-xl"
              />
              <p className="text-sm text-muted-foreground">{dictionary.event.importEventPlayersHint}</p>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsOpen(false)} disabled={isPending}>
            {dictionary.common.cancel}
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            onClick={handleSubmit}
            disabled={isPending || !normalizedLinks || (importPlayers && !normalizedClanTag)}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {dictionary.event.importEvents}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
