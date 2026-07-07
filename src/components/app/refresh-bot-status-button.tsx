"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";

export function RefreshBotStatusButton({
  dictionary,
}: {
  dictionary: Dictionary;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleRefresh() {
    const response = await fetch("/api/auth/discord/refresh", {
      method: "POST",
    });
    const body = await response.json();

    if (!response.ok) {
      toast.error(body.error ?? dictionary.dashboard.botStatusRefreshError);
      return;
    }

    toast.success(dictionary.dashboard.botStatusRefreshed);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Button variant="outline" className="rounded-full" onClick={handleRefresh} disabled={isPending}>
      {isPending ? dictionary.dashboard.refreshingBotStatus : dictionary.dashboard.refreshBotStatus}
    </Button>
  );
}
