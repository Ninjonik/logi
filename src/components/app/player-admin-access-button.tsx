"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";

export function PlayerAdminAccessButton({
  serverId,
  playerId,
  initialIsAdmin,
  dictionary,
}: {
  serverId: string;
  playerId: string;
  initialIsAdmin: boolean;
  dictionary: Dictionary;
}) {
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);
  const [isPending, startTransition] = useTransition();
  function updateAdminAccess(nextIsAdmin: boolean) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/servers/${serverId}/admin-access`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            playerId,
            isAdmin: nextIsAdmin,
          }),
        });
        if (!response.ok) {
          throw new Error("Unable to update player admin access.");
        }
        setIsAdmin(nextIsAdmin);
        toast.success(nextIsAdmin ? dictionary.userManagement.adminAccessGranted : dictionary.userManagement.adminAccessRemoved);
      } catch {
        toast.error(dictionary.userManagement.adminAccessUpdateFailed);
      }
    });
  }

  return (
    <Button
      type="button"
      variant={isAdmin ? "secondary" : "outline"}
      className="rounded-xl"
      disabled={isPending}
      onClick={() => updateAdminAccess(!isAdmin)}
    >
      <ShieldCheck className="size-4" />
      {isAdmin ? dictionary.userManagement.removeAdminAccess : dictionary.userManagement.grantAdminAccess}
    </Button>
  );
}
