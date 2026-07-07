import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { UserAssignmentForm } from "@/components/app/user-assignment-form";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";
import { getEligibleUsersForServer, getServerUserAssignments } from "@/lib/server-user-management";

export default async function CreateServerUserPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { server, groups = [] } = context;

  const assignments = await getServerUserAssignments(serverId);
  const eligibleUsers = await getEligibleUsersForServer(server, assignments);

  return (
    <>
      <PageHeader title={dictionary.userManagement.addPlayer} description={dictionary.userManagement.description} />
      <div className="px-4 lg:px-6">
        <UserAssignmentForm locale={safeLocale} server={server} dictionary={dictionary} eligibleUsers={eligibleUsers} groups={groups} createMode />
      </div>
    </>
  );
}
