"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/i18n/dictionaries";
import { groupSchema, type GroupInput } from "@/lib/validation/group";
import type { Group } from "@/types/domain";

export function GroupForm({
  serverId,
  locale,
  dictionary,
  group,
  createMode = false,
  availableGroups = [],
}: {
  serverId: string;
  locale: string;
  dictionary: Dictionary;
  group?: Group;
  createMode?: boolean;
  availableGroups?: Group[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<GroupInput>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: group?.name ?? "",
      color: group?.color ?? "#64748b",
      order: group?.order ?? 0,
      parentId: group?.parentId ?? undefined,
      description: group?.description ?? "",
    },
  });

  const filteredParentGroups = availableGroups.filter(
    (g) => g.id !== group?.id && !g.parentId,
  );

  async function submit(values: GroupInput) {
    const finalValues = {
      ...values,
      parentId: values.parentId === "none" ? undefined : values.parentId,
    };

    const response = await fetch(
      createMode ? `/api/servers/${serverId}/groups` : `/api/servers/${serverId}/groups/${group?.id}`,
      {
        method: createMode ? "POST" : "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(finalValues),
      },
    );

    const body = await response.json();
    if (!response.ok) {
      form.setError("root", {
        message: body.error ?? "Unable to save group.",
      });
      toast.error(body.error ?? "Unable to save group.");
      return;
    }

    toast.success(createMode ? "Group created" : "Group updated");

    startTransition(() => {
      router.push(`/${locale}/dashboard/servers/${serverId}/groups${createMode ? `/${body.groupId}` : ""}`);
      router.refresh();
    });
  }

  async function removeGroup() {
    if (!group) return;
    const response = await fetch(`/api/servers/${serverId}/groups/${group.id}`, {
      method: "DELETE",
    });
    const body = await response.json();
    if (!response.ok) {
      form.setError("root", {
        message: body.error ?? "Unable to delete group.",
      });
      toast.error(body.error ?? "Unable to delete group.");
      return;
    }

    toast.success("Group deleted");

    startTransition(() => {
      router.push(`/${locale}/dashboard/servers/${serverId}/groups`);
      router.refresh();
    });
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>{createMode ? dictionary.groups.createTitle : group?.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
          <div className="grid gap-4 md:grid-cols-[1fr_112px_112px]">
            <div className="space-y-2">
              <Label>{dictionary.groups.name}</Label>
              <Input {...form.register("name")} className="rounded-xl" />
              {form.formState.errors.name ? <p className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>{dictionary.groups.order}</Label>
              <Input type="number" {...form.register("order", { valueAsNumber: true })} className="rounded-xl" />
              {form.formState.errors.order ? <p className="text-sm text-destructive">{form.formState.errors.order.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>{dictionary.groups.color}</Label>
              <Input type="color" {...form.register("color")} className="h-11 rounded-xl p-1" />
              {form.formState.errors.color ? <p className="text-sm text-destructive">{form.formState.errors.color.message}</p> : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{dictionary.groups.parent}</Label>
            <Controller
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? "none"}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={dictionary.groups.none} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{dictionary.groups.none}</SelectItem>
                    {filteredParentGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>{dictionary.groups.descriptionLabel}</Label>
            <Textarea {...form.register("description")} className="min-h-28 rounded-xl" />
          </div>
          {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button className="rounded-xl" type="submit" disabled={isPending || form.formState.isSubmitting}>
              {dictionary.common.save}
            </Button>
            {group ? (
              <Button
                type="button"
                variant="destructive"
                className="rounded-xl"
                onClick={removeGroup}
                disabled={isPending || form.formState.isSubmitting}
              >
                {dictionary.common.clear}
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
