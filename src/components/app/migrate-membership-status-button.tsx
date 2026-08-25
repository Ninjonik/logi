"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DiscordEntitySelect, type DiscordSelectOption } from "@/components/app/discord-entity-select";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/i18n/dictionaries";

type DiscordMetadata = {
  roles: DiscordSelectOption[];
};

type MigrationTarget = "recruit" | "member" | "reserve_member" | "mercenary";

export function MigrateMembershipStatusButton({
  serverId,
  dictionary,
  defaultRoleId,
}: {
  serverId: string;
  dictionary: Dictionary;
  defaultRoleId?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [metadata, setMetadata] = useState<DiscordMetadata | null>(null);
  const [roleId, setRoleId] = useState(defaultRoleId ?? "");
  const [target, setTarget] = useState<MigrationTarget>("member");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    fetch(`/api/servers/${serverId}/discord-metadata`)
      .then((response) => response.json())
      .then((body) => setMetadata({ roles: body.roles ?? [] }))
      .catch(() => setMetadata({ roles: [] }));
  }, [isOpen, serverId]);

  function getTargetLabel(value: MigrationTarget) {
    switch (value) {
      case "recruit":
        return dictionary.userManagement.recruitLabel;
      case "reserve_member":
        return dictionary.userManagement.reserveMemberLabel;
      case "mercenary":
        return dictionary.userManagement.mercLabel;
      default:
        return dictionary.userManagement.memberLabel;
    }
  }

  function handleSubmit() {
    startTransition(async () => {
      const response = await fetch(`/api/servers/${serverId}/users/migrate-membership-status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roleId,
          target,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? dictionary.common.error);
        return;
      }

      toast.success(
        dictionary.userManagement.membershipMigrationSuccess
          .replace("{updated}", String(body.updatedCount ?? 0))
          .replace("{status}", getTargetLabel(target)),
      );

      if ((body.skippedUnassigned ?? 0) > 0) {
        toast.message(
          dictionary.userManagement.membershipMigrationSkippedUnassigned
            .replace("{count}", String(body.skippedUnassigned)),
        );
      }

      if ((body.skippedUnchanged ?? 0) > 0) {
        toast.message(
          dictionary.userManagement.membershipMigrationSkippedUnchanged
            .replace("{count}", String(body.skippedUnchanged)),
        );
      }

      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          <UsersRound className="size-4" />
          {dictionary.userManagement.membershipMigration}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{dictionary.userManagement.membershipMigration}</DialogTitle>
          <DialogDescription>{dictionary.userManagement.membershipMigrationDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{dictionary.userManagement.discordSourceRole}</Label>
            <DiscordEntitySelect
              value={roleId}
              onChange={(value) => setRoleId(value ?? "")}
              options={metadata?.roles ?? []}
              placeholder={dictionary.userManagement.discordSourceRole}
              allowNone={false}
            />
          </div>
          <div className="space-y-2">
            <Label>{dictionary.userManagement.membershipMigrationTarget}</Label>
            <Select value={target} onValueChange={(value) => setTarget(value as MigrationTarget)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recruit">{dictionary.userManagement.recruitLabel}</SelectItem>
                <SelectItem value="member">{dictionary.userManagement.memberLabel}</SelectItem>
                <SelectItem value="reserve_member">{dictionary.userManagement.reserveMemberLabel}</SelectItem>
                <SelectItem value="mercenary">{dictionary.userManagement.mercLabel}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">{dictionary.userManagement.membershipMigrationHint}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsOpen(false)} disabled={isPending}>
            {dictionary.common.cancel}
          </Button>
          <Button type="button" className="rounded-xl" onClick={handleSubmit} disabled={isPending || !roleId}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <UsersRound className="size-4" />}
            {dictionary.userManagement.membershipMigration}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
