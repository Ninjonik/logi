"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import type { AppUser, Guild } from "@/types/domain";
import type { ServerUserAssignment } from "@/lib/server-user-management";

type EligibleUser = {
  user: AppUser;
  existingHere?: ServerUserAssignment;
  canJoinAsMember: boolean;
  canJoinAsMercenary: boolean;
};

export function UserAssignmentForm({
  server,
  dictionary,
  eligibleUsers,
  assignment,
  createMode = false,
}: {
  server: Guild;
  dictionary: Dictionary;
  eligibleUsers: EligibleUser[];
  assignment?: ServerUserAssignment;
  createMode?: boolean;
}) {
  const selectedExisting = assignment
    ? eligibleUsers.find((item) => item.user.id === assignment.userId)
    : undefined;
  const [query, setQuery] = useState(selectedExisting?.user.name ?? "");
  const [selectedUserId, setSelectedUserId] = useState(selectedExisting?.user.id ?? "");
  const [type, setType] = useState<"member" | "mercenary">(assignment?.type ?? "member");
  const [group, setGroup] = useState(assignment?.group ?? "");
  const [paused, setPaused] = useState(assignment?.paused ?? false);
  const [pausedNote, setPausedNote] = useState(assignment?.pausedNote ?? "");

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

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>{createMode ? dictionary.userManagement.addPlayer : dictionary.userManagement.editAssignment}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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
                  setSelectedUserId(user.id);
                  setQuery(user.name);
                  if (!canJoinAsMember && canJoinAsMercenary) setType("mercenary");
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
        </div>

        {selected ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{dictionary.userManagement.assignmentType}</Label>
              <Select value={type} onValueChange={(value: "member" | "mercenary") => setType(value)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member" disabled={memberDisabled}>
                    Main member
                  </SelectItem>
                  <SelectItem value="mercenary" disabled={mercDisabled}>
                    Mercenary
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{dictionary.userManagement.tableGroup}</Label>
              <Input value={group} onChange={(event) => setGroup(event.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                <div>
                  <div className="font-medium">{dictionary.userManagement.pauseMembership}</div>
                  <div className="text-sm text-muted-foreground">{dictionary.userManagement.pauseHelp}</div>
                </div>
                <Switch checked={paused} onCheckedChange={setPaused} />
              </div>
            </div>
            {paused ? (
              <div className="space-y-2 md:col-span-2">
                <Label>{dictionary.userManagement.pauseNote}</Label>
                <Textarea value={pausedNote} onChange={(event) => setPausedNote(event.target.value)} className="min-h-24 rounded-xl" />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
            {dictionary.userManagement.pickPlayerFirst}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button className="rounded-xl">{dictionary.common.saveAssignment}</Button>
          {!createMode ? <Button variant="destructive" className="rounded-xl">{dictionary.common.removeAssignment}</Button> : null}
        </div>
      </CardContent>
    </Card>
  );
}
