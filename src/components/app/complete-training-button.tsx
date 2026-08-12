"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, SquareCheckBig } from "lucide-react";
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

type CompletionState = "passed" | "failed" | "pending";

export function CompleteTrainingButton({
  serverId,
  eventId,
  disabled,
  dictionary,
  attendees,
}: {
  serverId: string;
  eventId: string;
  disabled: boolean;
  dictionary: Dictionary;
  attendees: Array<{
    userId: string;
    label: string;
    completed?: "passed" | "failed";
  }>;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const initialStates = useMemo(
    () => Object.fromEntries(attendees.map((attendee) => [attendee.userId, attendee.completed ?? "pending"])) as Record<string, CompletionState>,
    [attendees],
  );
  const [completionByUserId, setCompletionByUserId] = useState<Record<string, CompletionState>>(initialStates);

  const allResolved = attendees.every((attendee) => completionByUserId[attendee.userId] === "passed" || completionByUserId[attendee.userId] === "failed");

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen);
    if (nextOpen) {
      setCompletionByUserId(initialStates);
    }
  }

  function handleSubmit() {
    startTransition(async () => {
      const participants = attendees.map((attendee) => ({
        userId: attendee.userId,
        completed: completionByUserId[attendee.userId] as "passed" | "failed",
      }));

      const response = await fetch(`/api/servers/${serverId}/events/${eventId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "completeTraining",
          participants,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? dictionary.common.error);
        return;
      }

      toast.success(dictionary.event.trainingCompletionSuccess
        .replace("{rewarded}", String(body.rewardedUsers ?? 0))
        .replace("{dmed}", String(body.dmSentUsers ?? 0)));
      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl" disabled={disabled}>
          <SquareCheckBig className="size-4" />
          {dictionary.event.conclude}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>{dictionary.event.trainingCompletionTitle}</DialogTitle>
          <DialogDescription>{dictionary.event.trainingCompletionDescription}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {attendees.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {dictionary.event.trainingCompletionEmpty}
            </div>
          ) : attendees.map((attendee) => {
            const selected = completionByUserId[attendee.userId] ?? "pending";

            return (
              <div key={attendee.userId} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <div>
                  <div className="font-medium">{attendee.label}</div>
                  <div className="text-xs text-muted-foreground">{attendee.userId}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={selected === "passed" ? "default" : "outline"}
                    className="rounded-xl"
                    onClick={() => setCompletionByUserId((current) => ({ ...current, [attendee.userId]: "passed" }))}
                  >
                    {dictionary.event.trainingPassed}
                  </Button>
                  <Button
                    type="button"
                    variant={selected === "failed" ? "destructive" : "outline"}
                    className="rounded-xl"
                    onClick={() => setCompletionByUserId((current) => ({ ...current, [attendee.userId]: "failed" }))}
                  >
                    {dictionary.event.trainingFailed}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsOpen(false)} disabled={isPending}>
            {dictionary.common.cancel}
          </Button>
          <Button type="button" className="rounded-xl" onClick={handleSubmit} disabled={isPending || attendees.length === 0 || !allResolved}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <SquareCheckBig className="size-4" />}
            {dictionary.event.trainingCompleteAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
