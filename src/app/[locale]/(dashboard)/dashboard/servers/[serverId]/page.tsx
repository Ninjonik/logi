import type { Metadata } from "next";
import { CalendarDays, ClipboardList, Radio, Users } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { HelperDataActions } from "@/components/app/helper-data-actions";
import { StatCard } from "@/components/app/stat-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";
import { getUsersByIds } from "@/lib/server-user-management";
import { formatDate } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}): Promise<Metadata> {
  const { locale, serverId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const context = await getServerContext(serverId);
  const dictionary = getDictionary(safeLocale);

  return {
    title: `${context?.server?.name ?? "Clan"} ${dictionary.sidebar.overview}`,
    description: context?.server?.description,
    alternates: { canonical: `/${safeLocale}/dashboard/servers/${serverId}` },
  };
}

export default async function ServerOverviewPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  if (!context) return null;
  const {
    server,
    events,
    rosters,
    canAdmin,
    assignments = [],
    groups = [],
    squadPresets = [],
    topicPresets = [],
  } = context;

  const publishedRosters = rosters.filter((roster) => roster.published);
  const memberAssignments = assignments.filter((assignment) => assignment.type === "member");
  const memberUsers = await getUsersByIds(memberAssignments.map((member) => member.userId));
  const memberUserById = new Map(memberUsers.map((user) => [user.id, user]));
  const groupNameById = new Map(groups.map((group) => [String(group.id), group.name]));
  const members = memberAssignments
    .map((member) => ({
      userId: member.userId,
      user: memberUserById.get(member.userId),
      primaryGroupName: member.primaryGroupId ? groupNameById.get(String(member.primaryGroupId)) : undefined,
      secondaryGroupNames: (member.secondaryGroupIds ?? [])
        .map((groupId) => groupNameById.get(String(groupId)))
        .filter((groupName): groupName is string => Boolean(groupName)),
    }))
    .filter((member) => member.user);

  return (
    <>
      <PageHeader title={server.name} description={server.description} />
      <div className="grid gap-4 px-4 md:grid-cols-2 xl:grid-cols-4 lg:px-6">
        <StatCard title={dictionary.clan.upcomingEvents} value={events.length} description={""} icon={CalendarDays} />
        <StatCard title={dictionary.clan.publishedRosters} value={publishedRosters.length} description={""} icon={Radio} />
        <StatCard title={dictionary.clan.members} value={server.memberIds.length} description={""}  icon={Users} />
        <StatCard title={dictionary.clan.presets} value={groups.length + squadPresets.length + topicPresets.length} description={""} icon={ClipboardList} />
      </div>
      <div className="grid gap-6 px-4 xl:grid-cols-[1.4fr_.9fr] lg:px-6">
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle>{dictionary.clan.membersAndGroups}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {members.map((member) => (
              <div key={member.userId} className="flex items-center gap-3 rounded-2xl border border-border/60 p-3">
                <Avatar className="size-11 rounded-xl">
                  <AvatarImage src={member.user?.avatar} alt={member.user?.name} />
                  <AvatarFallback>{member.user?.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{member.user?.name}</div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="rounded-full px-3">
                      {member.primaryGroupName ?? dictionary.userManagement.noGroup}
                    </Badge>
                    {member.secondaryGroupNames.length ? <span>{member.secondaryGroupNames.join(", ")}</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle>{dictionary.clan.snapshot}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{dictionary.clan.helperDataTitle}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {dictionary.clan.helperDataBody}
              </p>
              {canAdmin ? <div className="mt-4"><HelperDataActions serverId={serverId} dictionary={dictionary} /></div> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
