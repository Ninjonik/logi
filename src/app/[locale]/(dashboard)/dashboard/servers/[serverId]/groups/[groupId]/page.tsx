import type { Metadata } from "next";

import { GroupForm } from "@/components/app/group-form";
import { PageHeader } from "@/components/app/page-header";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; groupId: string }>;
}): Promise<Metadata> {
  const { serverId, groupId } = await params;
  const context = await getServerContext(serverId);
  const group = context?.groups.find((item) => item.id === groupId);
  return {
    title: group?.name ?? "Group",
    description: group?.description,
  };
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string; groupId: string }>;
}) {
  const { locale, serverId, groupId } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  const context = await getServerContext(serverId);
  if (!context) return null;

  const group = (context.groups ?? []).find((item) => item.id === groupId);
  if (!group) return null;

  return (
    <>
      <PageHeader title={group.name} description={group.description} />
      <div className="px-4 lg:px-6">
        <GroupForm
          serverId={serverId}
          locale={locale}
          dictionary={dictionary}
          group={group}
          availableGroups={context.groups ?? []}
        />
      </div>
    </>
  );
}
