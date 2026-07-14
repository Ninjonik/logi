import type { Metadata } from "next";

import { AutoLinkPlatformIdsButton } from "@/components/app/auto-link-platform-ids-button";
import { ImportDiscordMembersButton } from "@/components/app/import-discord-members-button";
import { PageHeader } from "@/components/app/page-header";
import { ResourceTable, StatusBadge } from "@/components/app/resource-table";
import { TablePageLayout } from "@/components/app/table-page-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getPaginatedRows } from "@/lib/data-table";
import { getGuildMetadata } from "@/lib/server-metadata";
import { getServerUserAssignments, getUsersByIds } from "@/lib/server-user-management";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}): Promise<Metadata> {
  const { serverId, locale } = await params;
  const server = await getGuildMetadata(serverId);
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: `${server?.name ?? "Clan"} ${dictionary.userManagement.title}`,
    description: dictionary.userManagement.description,
  };
}

export default async function ServerUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; serverId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, serverId } = await params;
  const resolvedSearchParams = await searchParams;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { groups, discordConfig } = context;
  const assignments = await getServerUserAssignments(serverId);
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
  const assignmentUsers = await getUsersByIds(assignments.map((assignment) => assignment.userId));
  const assignmentUserMap = new Map(assignmentUsers.map((user) => [user.id, user]));
  const paginated = getPaginatedRows({
    rows: assignments,
    searchParams: resolvedSearchParams,
    getSearchText: (assignment) => {
      const user = assignmentUserMap.get(assignment.userId);
      return [
        user?.name,
        user?.id,
        user?.platformId,
        String(user?.score ?? ""),
        groupNameById.get(assignment.primaryGroupId ?? ""),
        assignment.type,
        assignment.paused ? dictionary.userManagement.paused : dictionary.userManagement.active,
      ].filter(Boolean).join(" ");
    },
  });

  return (
    <TablePageLayout
      header={
        <PageHeader
          title={dictionary.userManagement.title}
          description={dictionary.userManagement.description}
          actions={
            <div className="flex flex-wrap gap-2">
              <AutoLinkPlatformIdsButton serverId={serverId} dictionary={dictionary} />
              <ImportDiscordMembersButton
                serverId={serverId}
                dictionary={dictionary}
                defaultRoleId={discordConfig?.clanRoleId}
              />
              <Button asChild className="rounded-xl">
                <a href={`/${locale}/dashboard/servers/${serverId}/users/create`}>{dictionary.userManagement.addPlayer}</a>
              </Button>
            </div>
          }
        />
      }
    >
        <ResourceTable
          className="h-full"
          dictionary={dictionary}
          rows={paginated.rows}
          page={paginated.page}
          pageSize={paginated.pageSize}
          pageCount={paginated.pageCount}
          totalRows={paginated.totalRows}
          search={paginated.search}
          searchPlaceholder={dictionary.userManagement.searchPlaceholder}
          getHref={(assignment) => `/${locale}/dashboard/servers/${serverId}/users/${assignment.id}`}
          columns={[
            {
              key: "player",
              title: dictionary.userManagement.tablePlayer,
              render: (assignment) => {
                const user = assignmentUserMap.get(assignment.userId);
                if (!user) return dictionary.common.unknown;
                return (
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9 rounded-lg">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {user.id}{user.platformId ? ` • ${dictionary.userManagement.platformId}: ${user.platformId}` : ""}
                      </div>
                    </div>
                  </div>
                );
              },
            },
            {
              key: "type",
              title: dictionary.userManagement.tableType,
              render: (assignment) => assignment.type === "member" ? dictionary.userManagement.memberLabel : dictionary.userManagement.mercLabel,
            },
            {
              key: "group",
              title: dictionary.userManagement.tableGroup,
              render: (assignment) => assignment.primaryGroupId ? groupNameById.get(assignment.primaryGroupId) ?? dictionary.userManagement.none : dictionary.userManagement.none,
            },
            {
              key: "score",
              title: dictionary.userManagement.tableScore,
              render: (assignment) => {
                const user = assignmentUserMap.get(assignment.userId);
                if (!user) {
                  return 0;
                }

                const kd = user.performance?.averages.killDeathRatio;
                return typeof kd === "number"
                  ? `${user.score} • ${dictionary.userManagement.matchKd} ${kd.toFixed(kd % 1 === 0 ? 0 : 2)}`
                  : user.score;
              },
            },
            {
              key: "state",
              title: dictionary.userManagement.tableState,
              render: (assignment) => (
                <StatusBadge
                  active={!assignment.paused}
                  activeLabel={dictionary.userManagement.active}
                  inactiveLabel={dictionary.userManagement.paused}
                />
              ),
            },
          ]}
        />
    </TablePageLayout>
  );
}
