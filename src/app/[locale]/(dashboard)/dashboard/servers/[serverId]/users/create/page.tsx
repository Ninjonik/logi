import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { UserAssignmentForm } from "@/components/app/user-assignment-form";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";
import { getEligibleUsersForServer, getServerUserAssignments } from "@/lib/server-user-management";

export const metadata: Metadata = {
  title: "Add player",
  description: "Add a player as a clan member or mercenary from the in-system user list.",
};

export default async function CreateServerUserPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string }>;
}) {
  const { locale, serverId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const { server } = getServerContext(serverId);
  if (!server) return null;

  const assignments = getServerUserAssignments(serverId);
  const eligibleUsers = getEligibleUsersForServer(server, assignments);

  return (
    <>
      <PageHeader title="Add player" description="Search known users, choose member or mercenary, set group, and optionally pause the assignment." />
      <div className="px-4 lg:px-6">
        <UserAssignmentForm server={server} dictionary={dictionary} eligibleUsers={eligibleUsers} createMode />
      </div>
    </>
  );
}
