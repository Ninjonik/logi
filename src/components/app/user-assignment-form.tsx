"use client";

import { useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { PencilLine, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { formatPlatformIds } from "@/lib/platform-ids";
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

function getAssignmentErrorMessage(errorCode: string | undefined, dictionary: Dictionary) {
  switch (errorCode) {
    case "PRIMARY_GROUP_REQUIRED":
      return dictionary.userManagement.primaryGroupRequired;
    case "ALREADY_ASSIGNED":
      return dictionary.userManagement.alreadyAssigned;
    case "PLATFORM_ALREADY_LINKED":
      return dictionary.userManagement.platformAlreadyLinked;
    default:
      return dictionary.userManagement.saveError;
  }
}

function getValidationMessage(message: string | undefined, dictionary: Dictionary) {
  if (!message) return "";
  if (message === "Pick a primary group.") return dictionary.userManagement.primaryGroupRequired;
  if (message === "Pick a player first.") return dictionary.userManagement.pickPlayerFirst;
  if (message === "Add a pause note when membership is paused.") return dictionary.userManagement.pauseNoteRequired;
  return message;
}

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
  const [isEditing, setIsEditing] = useState(createMode);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<UserAssignmentInput>({
    resolver: zodResolver(userAssignmentSchema),
    defaultValues: {
      userId: assignment?.userId ?? "",
      type: assignment?.type ?? "member",
      primaryGroupId: assignment?.primaryGroupId ?? "",
      secondaryGroupIds: assignment?.secondaryGroupIds ?? [],
      score: assignment ? (eligibleUsers.find((item) => item.user.id === assignment.userId)?.user.score ?? 0) : 0,
      platformIds: assignment ? formatPlatformIds(eligibleUsers.find((item) => item.user.id === assignment.userId)?.user.platformIds) : "",
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
  const showPlayerPicker = createMode;
  const canEditFields = createMode || isEditing;

  async function submit(values: UserAssignmentInput) {
    setServerError(null);
    const payload = {
      ...values,
      primaryGroupId: values.primaryGroupId || undefined,
    };
    const url = createMode
      ? `/api/servers/${server.id}/assignments`
      : `/api/servers/${server.id}/assignments/${assignment?.id}`;
    const method = createMode ? "POST" : "PATCH";
    const response = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    if (!response.ok) {
      const message = getAssignmentErrorMessage(body.errorCode, dictionary);
      setServerError(message);
      toast.error(message);
      return;
    }

    toast.success(createMode ? dictionary.userManagement.assignmentCreated : dictionary.userManagement.assignmentSaved);

    startTransition(() => {
      if (!createMode) {
        setIsEditing(false);
      }
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
      const message = body.error ?? dictionary.userManagement.deleteError;
      setServerError(message);
      toast.error(message);
      return;
    }

    toast.success(dictionary.userManagement.assignmentDeleted);

    startTransition(() => {
      router.push(`/${locale}/dashboard/servers/${server.id}/users`);
      router.refresh();
    });
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle>{createMode ? dictionary.userManagement.addPlayer : dictionary.userManagement.editAssignment}</CardTitle>
        {!createMode ? (
          <Button
            type="button"
            variant={isEditing ? "secondary" : "default"}
            className="rounded-xl"
            onClick={() => setIsEditing((value) => !value)}
          >
            <PencilLine className="size-4" />
            {dictionary.common.edit}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
          {showPlayerPicker ? (
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
                      form.setValue("score", user.score, { shouldValidate: true });
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
                      <div className="truncate text-xs text-muted-foreground">
                        {dictionary.userManagement.mainClan}: {user.guildId ?? dictionary.userManagement.none} • {user.score} {dictionary.navUser.scoreSuffix}
                      </div>
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
                <p className="text-sm text-destructive">{getValidationMessage(form.formState.errors.userId.message, dictionary)}</p>
              ) : null}
            </div>
          ) : selected ? (
            <div className="rounded-2xl border border-border/60 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-11 rounded-xl">
                  <AvatarImage src={selected.user.avatar} alt={selected.user.name} />
                  <AvatarFallback>{selected.user.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{selected.user.name}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {selected.user.id} • {selected.user.score} {dictionary.navUser.scoreSuffix}
                  </div>
                </div>
                <Badge variant={selected.canJoinAsMember ? "default" : "secondary"} className="rounded-full px-2.5">
                  {dictionary.userManagement.memberLabel}
                </Badge>
                <Badge variant={selected.canJoinAsMercenary ? "default" : "secondary"} className="rounded-full px-2.5">
                  {dictionary.userManagement.mercLabel}
                </Badge>
              </div>
            </div>
          ) : null}

          {selected ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{dictionary.userManagement.assignmentType}</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    canEditFields ? (
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
                    ) : (
                      <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                        {field.value === "member" ? dictionary.userManagement.memberLabel : dictionary.userManagement.mercLabel}
                      </div>
                    )
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>{dictionary.userManagement.primaryGroup}</Label>
                <Controller
                  control={form.control}
                  name="primaryGroupId"
                  render={({ field }) => (
                    canEditFields ? (
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
                    ) : (
                      <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                        {groups.find((group) => group.id === field.value)?.name ?? dictionary.userManagement.noGroup}
                      </div>
                    )
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>{dictionary.userManagement.tableScore}</Label>
                {canEditFields ? (
                  <Input
                    type="number"
                    step="1"
                    {...form.register("score", { valueAsNumber: true })}
                    className="rounded-xl"
                  />
                ) : (
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                    {form.getValues("score")}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>{dictionary.userManagement.platformId}</Label>
                {canEditFields ? (
                  <Input
                    type="text"
                    inputMode="text"
                    placeholder={dictionary.shared.notSet}
                    {...form.register("platformIds")}
                    className="rounded-xl"
                  />
                ) : (
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                    {formatPlatformIds(selected.user.platformIds) || dictionary.shared.notSet}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {selected.user.platformIds.length
                    ? dictionary.userManagement.platformConnectedAs.replace("{platformId}", formatPlatformIds(selected.user.platformIds))
                    : dictionary.userManagement.platformNotConnected}
                </p>
                {form.formState.errors.platformIds ? (
                  <p className="text-sm text-destructive">{getValidationMessage(form.formState.errors.platformIds.message, dictionary)}</p>
                ) : null}
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label>{dictionary.userManagement.secondaryGroups}</Label>
                {canEditFields ? (
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
                ) : (
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm">
                    {secondaryGroupIds.length
                      ? secondaryGroupIds.map((groupId) => groups.find((group) => group.id === groupId)?.name ?? groupId).join(", ")
                      : dictionary.userManagement.noSecondaryGroups}
                  </div>
                )}
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
                    render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEditFields} />}
                  />
              </div>
              {form.formState.errors.primaryGroupId ? (
                <p className="text-sm text-destructive">{getValidationMessage(form.formState.errors.primaryGroupId.message, dictionary)}</p>
              ) : null}
            </div>
              {paused ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>{dictionary.userManagement.pauseNote}</Label>
                  {canEditFields ? (
                    <Textarea {...form.register("pausedNote")} className="min-h-24 rounded-xl" />
                  ) : (
                    <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                      {form.getValues("pausedNote") || dictionary.shared.notSet}
                    </div>
                  )}
                  {form.formState.errors.pausedNote ? (
                    <p className="text-sm text-destructive">{getValidationMessage(form.formState.errors.pausedNote.message, dictionary)}</p>
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

          {canEditFields ? (
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-xl" type="submit" disabled={isPending || form.formState.isSubmitting}>
                {dictionary.common.saveAssignment}
              </Button>
              {!createMode ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      form.reset({
                        userId: assignment?.userId ?? "",
                        type: assignment?.type ?? "member",
                      primaryGroupId: assignment?.primaryGroupId ?? "",
                      secondaryGroupIds: assignment?.secondaryGroupIds ?? [],
                      score: selected?.user.score ?? 0,
                      platformIds: formatPlatformIds(selected?.user.platformIds),
                      paused: assignment?.paused ?? false,
                      pausedNote: assignment?.pausedNote ?? "",
                    });
                      setIsEditing(false);
                    }}
                    disabled={isPending || form.formState.isSubmitting}
                  >
                    {dictionary.common.cancel}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="rounded-xl"
                    onClick={removeAssignment}
                    disabled={isPending || form.formState.isSubmitting}
                  >
                    {dictionary.common.removeAssignment}
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
