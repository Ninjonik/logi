"use client";

import { useMemo, useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";

function normalizeLinks(value: string) {
  return value
    .split(/[\n,]+/g)
    .map((entry) => entry.trim().replace(/\s+/g, ""))
    .filter(Boolean)
    .join("\n");
}

type ImportProgress = {
  phase: "queued" | "fetching" | "importing" | "completed";
  total: number;
  fetched: number;
  processed: number;
  successful: number;
  failed: number;
  percent: number;
  currentLink?: string;
};

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
  const [isPending, setIsPending] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const normalizedLinks = useMemo(() => normalizeLinks(links), [links]);
  const normalizedClanTag = useMemo(() => clanTag.trim(), [clanTag]);
  const linkCount = normalizedLinks ? normalizedLinks.split("\n").length : 0;

  async function handleSubmit() {
    setIsPending(true);
    setProgress({
      phase: "queued",
      total: linkCount,
      fetched: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      percent: 0,
    });

    try {
      const response = await fetch(`/api/servers/${serverId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "importEvents",
          links: normalizedLinks,
          importPlayers,
          clanTag: importPlayers ? normalizedClanTag : undefined,
          streamProgress: true,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        toast.error(body.error ?? dictionary.common.error);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        toast.error(dictionary.common.error);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: any = null;
      let streamError: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const payload = JSON.parse(line) as {
            type: "progress" | "result" | "error";
            progress?: ImportProgress;
            result?: any;
            error?: string;
          };

          if (payload.type === "progress" && payload.progress) {
            setProgress(payload.progress);
          } else if (payload.type === "result") {
            finalResult = payload.result;
          } else if (payload.type === "error") {
            streamError = payload.error ?? dictionary.common.error;
          }
        }
      }

      if (streamError) {
        toast.error(streamError);
        return;
      }

      if (!finalResult) {
        toast.error(dictionary.common.error);
        return;
      }

      toast.success(
        dictionary.event.importEventsSuccess
          .replace("{events}", String(finalResult.importedEvents ?? 0))
          .replace("{players}", String(finalResult.importedPlayers ?? 0)),
      );

      if (Array.isArray(finalResult.failedLinks) && finalResult.failedLinks.length > 0) {
        toast.error(
          dictionary.event.importEventsPartial
            .replace("{failed}", String(finalResult.failedLinks.length)),
        );
      }

      setIsOpen(false);
      setLinks("");
      setImportPlayers(false);
      setClanTag("");
      router.refresh();
    } finally {
      setIsPending(false);
      setProgress(null);
    }
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
        {progress ? (
          <div className="space-y-2 rounded-xl border border-border/60 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Import progress</span>
              <span>{progress.percent}%</span>
            </div>
            <Progress value={progress.percent} className="h-2.5" />
            <p className="text-sm text-muted-foreground">
              {progress.phase === "fetching"
                ? `Fetched ${progress.fetched}/${progress.total} scoreboards`
                : `Processed ${progress.processed}/${progress.total} events • ${progress.successful} imported • ${progress.failed} failed`}
            </p>
          </div>
        ) : null}
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
