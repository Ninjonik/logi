"use client";

import { useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import type { UserAssignmentInput } from "@/lib/validation/user-assignment";
import { userAssignmentSchema } from "@/lib/validation/user-assignment";
import type { ServerUserAssignment } from "@/lib/server-user-management";
import type { AppUser, Group, Guild } from "@/types/domain";

type EligibleUser = {
  user: AppUser;
  existingHere?: ServerUserAssignment;
  canJoinAsMember: boolean;
  canJoinAsMercenary: boolean;
};

export function UserAssignmentForm({
  server,
  locale,
  dictionary,
  eligibleUsers,
  groups,
  assignment,
  createMode = false,
}: {
  server: Guild;
  locale: string;
  dictionary: Dictionary;
  eligibleUsers: EligibleUser[];
  groups: Group[];
  assignment?: ServerUserAssignment;
  createMode?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(
    assignment ? eligibleUsers.find((item) => item.user.id === assignment.userId)?.user.name ?? "" : "",
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<UserAssignmentInput>({
    resolver: zodResolver(userAssignmentSchema),
    defaultValues: {
      userId: assignment?.userId ?? "",
      type: assignment?.type ?? "member",
      primaryGroupId: assignment?.primaryGroupId ?? "",
      secondaryGroupIds: assignment?.secondaryGroupIds ?? [],
      paused: assignment?.paused ?? false,
      pausedNote: assignment?.pausedNote ?? "",
    },
  });

  const selectedUserId = form.watch("userId");
  const paused = form.watch("paused");
  const primaryGroupId = form.watch("primaryGroupId");
  const secondaryGroupIds = form.watch("secondaryGroupIds");

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return eligibleUsers.filter(({ user }) => {
      if (!normalized) return true;
      return user.name.toLowerCase().includes(normalized) || user.id.includes(normalized);
    });
  }, [eligibleUsers, query]);

  const selected = eligibleUsers.find((item) => item.user.id === selectedUserId);
  const memberDisabled = selected ? !selected.canJoinAsMember : false;
  const mercDisabled = selected ? !selected.canJoinAsMercenary : false;

  async function submit(values: UserAssignmentInput) {
    setServerError(null);
    const url = createMode
      ? `/api/servers/${server.id}/assignments`
      : `/api/servers/${server.id}/assignments/${assignment?.id}`;
    const method = createMode ? "POST" : "PATCH";
    const response = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(values),
    });

    const body = await response.json();
    if (!response.ok) {
      setServerError(body.error ?? "Unable to save assignment.");
      return;
    }

    startTransition(() => {
      router.push(`/${locale}/dashboard/servers/${server.id}/users${createMode ? `/${body.assignmentId}` : ""}`);
      router.refresh();
    });
  }

  async function removeAssignment() {
    if (!assignment) return;
    setServerError(null);
    const response = await fetch(`/api/servers/${server.id}/assignments/${assignment.id}`, {
      method: "DELETE",
    });
    const body = await response.json();
    if (!response.ok) {
      setServerError(body.error ?? "Unable to delete assignment.");
      return;
    }

    startTransition(() => {
      router.push(`/${locale}/dashboard/servers/${server.id}/users`);
      router.refresh();
    });
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>{createMode ? dictionary.userManagement.addPlayer : dictionary.userManagement.editAssignment}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
          <div className="space-y-3">
            <Label>{dictionary.userManagement.playerSearch}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={dictionary.userManagement.searchPlaceholder}
                className="rounded-xl pl-9"
              />
            </div>
            <div className="max-h-72 space-y-2 overflow-auto rounded-2xl border border-border/60 p-3">
              {matches.map(({ user, canJoinAsMember, canJoinAsMercenary }) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    form.setValue("userId", user.id, { shouldValidate: true });
                    setQuery(user.name);
                    if (!canJoinAsMember && canJoinAsMercenary) {
                      form.setValue("type", "mercenary", { shouldValidate: true });
                    }
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                    selectedUserId === user.id ? "border-primary bg-primary/5" : "border-border/60"
                  }`}
                >
                  <Avatar className="size-9 rounded-lg">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{user.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{dictionary.userManagement.mainClan}: {user.guildId ?? dictionary.userManagement.none}</div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={canJoinAsMember ? "default" : "secondary"} className="rounded-full px-2.5">
                      {dictionary.userManagement.memberLabel}
                    </Badge>
                    <Badge variant={canJoinAsMercenary ? "default" : "secondary"} className="rounded-full px-2.5">
                      {dictionary.userManagement.mercLabel}
                    </Badge>
                  </div>
                </button>
              ))}
              {!matches.length ? (
                <div className="py-6 text-center text-sm text-muted-foreground">{dictionary.userManagement.noResults}</div>
              ) : null}
            </div>
            {form.formState.errors.userId ? (
              <p className="text-sm text-destructive">{form.formState.errors.userId.message}</p>
            ) : null}
          </div>

          {selected ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{dictionary.userManagement.assignmentType}</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member" disabled={memberDisabled}>
                          {dictionary.userManagement.memberLabel}
                        </SelectItem>
                        <SelectItem value="mercenary" disabled={mercDisabled}>
                          {dictionary.userManagement.mercLabel}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>{dictionary.userManagement.primaryGroup}</Label>
                <Controller
                  control={form.control}
                  name="primaryGroupId"
                  render={({ field }) => (
                    <Select value={field.value || "__none__"} onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{dictionary.userManagement.noGroup}</SelectItem>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label>{dictionary.userManagement.secondaryGroups}</Label>
                <div className="grid gap-2 rounded-2xl border border-border/60 p-3 md:grid-cols-2">
                  {groups.map((group) => {
                    const checked = secondaryGroupIds.includes(group.id);
                    const disabled = primaryGroupId === group.id;
                    return (
                      <label key={group.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${disabled ? "opacity-50" : ""}`}>
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(nextChecked) => {
                            const nextValues = nextChecked
                              ? [...secondaryGroupIds, group.id]
                              : secondaryGroupIds.filter((groupId) => groupId !== group.id);
                            form.setValue("secondaryGroupIds", [...new Set(nextValues)], { shouldValidate: true });
                          }}
                        />
                        <span className="size-3 rounded-full border border-border/60" style={{ backgroundColor: group.color }} />
                        <span className="text-sm">{group.name}</span>
                      </label>
                    );
                  })}
                  {!groups.length ? <div className="text-sm text-muted-foreground">{dictionary.shared.nothingCreatedYet}</div> : null}
                </div>
                {form.formState.errors.secondaryGroupIds ? (
                  <p className="text-sm text-destructive">{form.formState.errors.secondaryGroupIds.message}</p>
                ) : null}
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                  <div>
                    <div className="font-medium">{dictionary.userManagement.pauseMembership}</div>
                    <div className="text-sm text-muted-foreground">{dictionary.userManagement.pauseHelp}</div>
                  </div>
                  <Controller
                    control={form.control}
                    name="paused"
                    render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                  />
                </div>
              </div>
              {paused ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>{dictionary.userManagement.pauseNote}</Label>
                  <Textarea {...form.register("pausedNote")} className="min-h-24 rounded-xl" />
                  {form.formState.errors.pausedNote ? (
                    <p className="text-sm text-destructive">{form.formState.errors.pausedNote.message}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
              {dictionary.userManagement.pickPlayerFirst}
            </div>
          )}

          {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button className="rounded-xl" type="submit" disabled={isPending || form.formState.isSubmitting}>
              {dictionary.common.saveAssignment}
            </Button>
            {!createMode ? (
              <Button
                type="button"
                variant="destructive"
                className="rounded-xl"
                onClick={removeAssignment}
                disabled={isPending || form.formState.isSubmitting}
              >
                {dictionary.common.removeAssignment}
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
