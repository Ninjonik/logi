"use client";

import { useState, useTransition } from "react";
import { makeFunctionReference } from "convex/server";
import { useMutation } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const setPlayerAdminAccessReference = makeFunctionReference<"mutation">("guilds:setPlayerAdminAccess");

export function PlayerAdminAccessButton({
  serverId,
  actorId,
  playerId,
  initialIsAdmin,
}: {
  serverId: string;
  actorId: string;
  playerId: string;
  initialIsAdmin: boolean;
}) {
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);
  const [isPending, startTransition] = useTransition();
  const setPlayerAdminAccess = useMutation(setPlayerAdminAccessReference);

  function updateAdminAccess(nextIsAdmin: boolean) {
    startTransition(async () => {
      try {
        await setPlayerAdminAccess({
          serverId: serverId as never,
          userId: actorId,
          playerId,
          isAdmin: nextIsAdmin,
        });
        setIsAdmin(nextIsAdmin);
        toast.success(nextIsAdmin ? "Player is now an admin." : "Player admin access removed.");
      } catch (error) {
        console.error(error);
        toast.error("Unable to update player admin access.");
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
      {isAdmin ? "Remove admin access" : "Make admin"}
    </Button>
  );
}
