import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable } from "@/components/app/resource-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; locale: string }>;
}): Promise<Metadata> {
  const { serverId, locale } = await params;
  const context = await getServerContext(serverId);
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: `${context?.server?.name ?? "Clan"} ${dictionary.sidebar.groups}`,
    description: dictionary.groups.description,
  };
}

export default async function GroupsPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  if (!context) return null;

  const { groups = [], assignments = [], canAdmin } = context;

  return (
    <>
      <PageHeader
        title={dictionary.sidebar.groups}
        description={dictionary.groups.description}
        actions={
          canAdmin ? (
            <Button asChild className="rounded-xl">
              <a href={`/${locale}/dashboard/servers/${serverId}/groups/create`}>{dictionary.groups.createTitle}</a>
            </Button>
          ) : undefined
        }
      />
      <div className="px-4 lg:px-6">
        <ResourceTable
          dictionary={dictionary}
          rows={groups}
          getHref={(group) => `/${locale}/dashboard/servers/${serverId}/groups/${group.id}`}
          columns={[
            {
              key: "name",
              title: dictionary.groups.name,
              render: (group) => (
                <div className="flex items-center gap-3">
                  <span className="size-3 rounded-full border border-border/60" style={{ backgroundColor: group.color }} />
                  <div className="font-medium">{group.name}</div>
                </div>
              ),
            },
            {
              key: "usage",
              title: dictionary.groups.usedByPlayers,
              render: (group) => assignments.filter((assignment) => assignment.primaryGroupId === group.id).length,
            },
            {
              key: "description",
              title: dictionary.groups.descriptionLabel,
              render: (group) => group.description ? <span>{group.description}</span> : <Badge variant="secondary">{dictionary.shared.notSet}</Badge>,
            },
          ]}
        />
      </div>
    </>
  );
}
