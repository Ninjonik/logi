"use client";

import { useEffect, useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
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

export function ImportDiscordMembersButton({
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
  const [assignmentType, setAssignmentType] = useState<"member" | "mercenary">("member");
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

  function handleSubmit() {
    startTransition(async () => {
      const response = await fetch(`/api/servers/${serverId}/users/import-discord`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roleId,
          assignmentType,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? dictionary.common.error);
        return;
      }

      toast.success(
        dictionary.userManagement.discordImportSuccess
          .replace("{players}", String(body.importedCount ?? 0))
          .replace("{matched}", String(body.matchedMembers ?? 0)),
      );

      if ((body.skippedIneligible ?? 0) > 0) {
        toast.error(
          dictionary.userManagement.discordImportSkipped
            .replace("{count}", String(body.skippedIneligible)),
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
          <Download className="size-4" />
          {dictionary.userManagement.importDiscordMembers}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{dictionary.userManagement.importDiscordMembers}</DialogTitle>
          <DialogDescription>{dictionary.userManagement.importDiscordMembersDescription}</DialogDescription>
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
            <Label>{dictionary.userManagement.assignmentType}</Label>
            <Select value={assignmentType} onValueChange={(value) => setAssignmentType(value as "member" | "mercenary")}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{dictionary.userManagement.memberLabel}</SelectItem>
                <SelectItem value="mercenary">{dictionary.userManagement.mercLabel}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {dictionary.userManagement.importDiscordMembersHint}
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsOpen(false)} disabled={isPending}>
            {dictionary.common.cancel}
          </Button>
          <Button type="button" className="rounded-xl" onClick={handleSubmit} disabled={isPending || !roleId}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {dictionary.userManagement.importDiscordMembers}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
