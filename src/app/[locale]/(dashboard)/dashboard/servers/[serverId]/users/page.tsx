import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable, StatusBadge } from "@/components/app/resource-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getAssignmentUser, getServerUserAssignments } from "@/lib/server-user-management";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}): Promise<Metadata> {
  const { serverId } = await params;
  const context = getServerContext(serverId);
  return {
    title: `${context.server?.name ?? "Clan"} ${getDictionary("en").userManagement.title}`,
    description: getDictionary("en").userManagement.description,
  };
}

export default async function ServerUsersPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const { server } = getServerContext(serverId);
  const assignments = getServerUserAssignments(serverId);

  if (!server) return null;

  return (
    <>
      <PageHeader
        title={dictionary.userManagement.title}
        description={dictionary.userManagement.description}
        actions={
          <Button asChild className="rounded-xl">
            <a href={`/${locale}/dashboard/servers/${serverId}/users/create`}>{dictionary.userManagement.addPlayer}</a>
          </Button>
        }
      />
      <div className="px-4 lg:px-6">
        <ResourceTable
          dictionary={dictionary}
          rows={assignments}
          getHref={(assignment) => `/${locale}/dashboard/servers/${serverId}/users/${assignment.id}`}
          columns={[
            {
              key: "player",
              title: dictionary.userManagement.tablePlayer,
              render: (assignment) => {
                const user = getAssignmentUser(assignment);
                if (!user) return dictionary.common.unknown;
                return (
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9 rounded-lg">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.id}</div>
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
              render: (assignment) => assignment.group ?? dictionary.userManagement.none,
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
      </div>
    </>
  );
}
