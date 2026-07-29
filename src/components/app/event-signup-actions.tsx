"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getClanDiscordMessages } from "@/lib/clan-language";
import { buildEventSignupActions } from "@/lib/event-signup";
import { cn } from "@/lib/utils";
import type { EventRecord, Group } from "@/types/domain";

export function EventSignupActions({
  serverId,
  event,
  groups,
  signupLanguage,
  className,
}: {
  serverId: string;
  event: EventRecord;
  groups: Group[];
  signupLanguage: "en" | "cs";
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const messages = getClanDiscordMessages(signupLanguage);
  const actions = buildEventSignupActions(event, groups, messages.buttons);

  async function handleSignup(actionId: string) {
    const response = await fetch(`/api/servers/${serverId}/events/${event.id}/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionId }),
    });
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.error ?? messages.interaction.unableToLoadEventContext);
      return;
    }

    toast.success(body.message ?? messages.interaction.signupUpdated);
    startTransition(() => router.refresh());
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {actions.map((action) => (
        <Button
          key={action.id}
          type="button"
          variant={action.kind === "decline" ? "destructive" : action.kind === "general" ? "default" : "outline"}
          className="rounded-xl"
          disabled={isPending}
          onClick={() => handleSignup(action.id)}
          style={action.kind === "group" ? {
            borderColor: `${action.color}66`,
            color: action.color,
            backgroundColor: `${action.color}14`,
          } : undefined}
        >
          {action.kind === "general" ? <span>✅</span> : null}
          {"emoji" in action && action.emoji ? <span>{action.emoji}</span> : null}
          {action.label}
        </Button>
      ))}
    </div>
  );
}
