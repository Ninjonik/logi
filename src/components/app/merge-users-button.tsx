"use client";

import { useMemo, useState, useTransition } from "react";
import { GitMerge, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EntitySelect } from "@/components/app/entity-select";
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
import type { Dictionary } from "@/i18n/dictionaries";

type MergeUserOption = {
  id: string;
  name: string;
};

export function MergeUsersButton({
  serverId,
  dictionary,
  users,
}: {
  serverId: string;
  dictionary: Dictionary;
  users: MergeUserOption[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [primaryUserId, setPrimaryUserId] = useState("");
  const [secondaryUserId, setSecondaryUserId] = useState("");
  const [isPending, startTransition] = useTransition();

  const secondaryOptions = useMemo(
    () => users.filter((user) => user.id !== primaryUserId),
    [users, primaryUserId],
  );

  function handleSubmit() {
    startTransition(async () => {
      const response = await fetch(`/api/servers/${serverId}/users/merge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          primaryUserId,
          secondaryUserId,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? dictionary.common.error);
        return;
      }

      toast.success(dictionary.userManagement.mergeUsersSuccess);
      setIsOpen(false);
      setPrimaryUserId("");
      setSecondaryUserId("");
      router.refresh();
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          <GitMerge className="size-4" />
          {dictionary.userManagement.mergeUsers}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{dictionary.userManagement.mergeUsers}</DialogTitle>
          <DialogDescription>{dictionary.userManagement.mergeUsersDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{dictionary.userManagement.mergeUsersPrimary}</Label>
            <EntitySelect
              value={primaryUserId}
              onChange={(value) => {
                const nextValue = value ?? "";
                setPrimaryUserId(nextValue);
                if (nextValue === secondaryUserId) {
                  setSecondaryUserId("");
                }
              }}
              options={users}
              placeholder={dictionary.userManagement.mergeUsersPickPrimary}
              allowNone={false}
            />
          </div>
          <div className="space-y-2">
            <Label>{dictionary.userManagement.mergeUsersSecondary}</Label>
            <EntitySelect
              value={secondaryUserId}
              onChange={(value) => setSecondaryUserId(value ?? "")}
              options={secondaryOptions}
              placeholder={dictionary.userManagement.mergeUsersPickSecondary}
              allowNone={false}
            />
          </div>
          <p className="text-sm text-muted-foreground">{dictionary.userManagement.mergeUsersHint}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsOpen(false)} disabled={isPending}>
            {dictionary.common.cancel}
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            onClick={handleSubmit}
            disabled={isPending || !primaryUserId || !secondaryUserId || primaryUserId === secondaryUserId}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <GitMerge className="size-4" />}
            {dictionary.userManagement.mergeUsersConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
