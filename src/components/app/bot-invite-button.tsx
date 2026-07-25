"use client";

import { useState } from "react";

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

export function BotInviteButton({
  dictionary,
  inviteUrl,
  roleHierarchyRelevant,
  className,
  variant = "default",
  children,
}: {
  dictionary: Dictionary;
  inviteUrl: string;
  roleHierarchyRelevant: boolean;
  className?: string;
  variant?: "default" | "outline";
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  function handleContinue() {
    window.open(inviteUrl, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          {children}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{dictionary.dashboard.inviteBotModalTitle}</DialogTitle>
          <DialogDescription>
            {roleHierarchyRelevant
              ? dictionary.dashboard.inviteBotModalDescription
              : dictionary.dashboard.inviteBotModalNotApplicable}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsOpen(false)}>
            {dictionary.common.cancel}
          </Button>
          <Button type="button" className="rounded-xl" onClick={handleContinue}>
            {dictionary.dashboard.inviteBotModalConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
