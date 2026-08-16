"use client";

import { useState, useTransition } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { makeFunctionReference } from "convex/server";

const resyncDashboardAdminsReference = makeFunctionReference<"mutation">("guilds:resyncDashboardAdmins");

export function ResyncDashboardAdminsButton({
  serverId,
  userId,
}: {
  serverId: string;
  userId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [clicked, setClicked] = useState(false);
  const resyncDashboardAdmins = useMutation(resyncDashboardAdminsReference);

  return (
    <Button
      variant="outline"
      className="rounded-xl"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            await resyncDashboardAdmins({ userId, serverId: serverId as never });
            setClicked(true);
            toast.success("Admin access resynced.");
          } catch (error) {
            console.error(error);
            toast.error("Unable to resync admin access.");
          }
        });
      }}
    >
      {clicked ? "Resynced" : "Resync admin access"}
    </Button>
  );
}
