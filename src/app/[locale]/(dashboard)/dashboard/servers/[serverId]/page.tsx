import type { Metadata } from "next";
import { CalendarDays, ClipboardList, Radio, Users } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { mockUsers } from "@/lib/mock-data";
import { getServerContext } from "@/lib/server-context";
import { formatDate } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}): Promise<Metadata> {
  const { locale, serverId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const context = getServerContext(serverId);
  const dictionary = getDictionary(safeLocale);

  return {
    title: `${context.server?.name ?? "Clan"} ${dictionary.sidebar.overview}`,
    description: context.server?.description,
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
  const { server, events, rosters, canAdmin } = getServerContext(serverId);

  if (!server) return null;

  const publishedRosters = rosters.filter((roster) => roster.published);
  const members = server.members
    .map((member) => ({
      ...member,
      user: mockUsers.find((user) => user.id === member.id),
    }))
    .filter((member) => member.user);

  return (
    <>
      <PageHeader title={server.name} description={server.description} badge={canAdmin ? dictionary.clan.adminAccess : dictionary.clan.memberAccess} />
      <div className="grid gap-4 px-4 md:grid-cols-2 xl:grid-cols-4 lg:px-6">
        <StatCard title={dictionary.clan.upcomingEvents} value={events.length} description={dictionary.calendarPage.description} icon={CalendarDays} />
        <StatCard title={dictionary.clan.publishedRosters} value={publishedRosters.length} description={dictionary.clan.visibilityBody} icon={Radio} />
        <StatCard title={dictionary.clan.members} value={server.memberIds.length} description={dictionary.userManagement.description} icon={Users} />
        <StatCard title={dictionary.clan.presets} value={server.id ? `${events.length + rosters.length}` : 0} description={dictionary.clan.backendBody} icon={ClipboardList} />
      </div>
      <div className="grid gap-6 px-4 xl:grid-cols-[1.4fr_.9fr] lg:px-6">
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle>{dictionary.clan.membersAndGroups}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-border/60 p-3">
                <Avatar className="size-11 rounded-xl">
                  <AvatarImage src={member.user?.avatar} alt={member.user?.name} />
                  <AvatarFallback>{member.user?.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{member.user?.name}</div>
                  <div className="truncate text-sm text-muted-foreground">{member.group}</div>
                </div>
                <Badge variant="secondary" className="rounded-full px-3">
                  {dictionary.clan.joined} {member.joinedAt ? formatDate(member.joinedAt) : dictionary.common.unknown}
                </Badge>
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
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{dictionary.clan.visibilityTitle}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {dictionary.clan.visibilityBody}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{dictionary.clan.backendTitle}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {dictionary.clan.backendBody}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{dictionary.clan.languageTitle}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {dictionary.clan.languageBody}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
