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

  return {
    title: `${context.server?.name ?? "Server"} overview`,
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
      <PageHeader title={server.name} description={server.description} badge={canAdmin ? "Admin access" : "Member access"} />
      <div className="grid gap-4 px-4 md:grid-cols-2 xl:grid-cols-4 lg:px-6">
        <StatCard title="Upcoming events" value={events.length} description="Calendar, event pages, and briefing flow ready." icon={CalendarDays} />
        <StatCard title="Published rosters" value={publishedRosters.length} description="Visible to members and mercenaries." icon={Radio} />
        <StatCard title="Members" value={server.memberIds.length} description="Core server membership synced later from Discord." icon={Users} />
        <StatCard title="Presets" value={server.id ? `${events.length + rosters.length}` : 0} description="Hybrid copied-reference workflow prepared." icon={ClipboardList} />
      </div>
      <div className="grid gap-6 px-4 xl:grid-cols-[1.4fr_.9fr] lg:px-6">
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle>Members and groups</CardTitle>
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
                  Joined {member.joinedAt ? formatDate(member.joinedAt) : "Unknown"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle>Server snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Who can see what</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Calendar is visible to logged-in users in this server. Events, presets, and unpublished rosters remain admin-only.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Backend prep</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Pages are wired around mock data and typed for Convex documents so we can drop in real queries later.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Language</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Locale routing is active with English dictionaries, so additional languages can be added without rewriting page structure.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
