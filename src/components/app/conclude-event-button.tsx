"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SquareCheckBig } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";

export function ConcludeEventButton({
  serverId,
  eventId,
  disabled,
  dictionary,
}: {
  serverId: string;
  eventId: string;
  disabled: boolean;
  dictionary: Dictionary;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleConclude() {
    startTransition(async () => {
      const response = await fetch(`/api/servers/${serverId}/events/${eventId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "conclude" }),
      });

      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? dictionary.common.error);
        return;
      }

      toast.success(dictionary.event.concludedSuccess);
      router.refresh();
    });
  }

  return (
    <Button variant="outline" className="rounded-xl" onClick={handleConclude} disabled={disabled || isPending}>
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <SquareCheckBig className="size-4" />}
      {dictionary.event.conclude}
    </Button>
  );
}
