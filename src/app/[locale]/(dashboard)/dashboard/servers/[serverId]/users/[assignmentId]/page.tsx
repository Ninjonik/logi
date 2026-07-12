import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { UserAssignmentForm } from "@/components/app/user-assignment-form";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getAssignmentMetadata, getPlayerMetadata } from "@/lib/server-metadata";
import { getServerContext } from "@/lib/server-context";
import {
  getEligibleUsersForServer,
  getServerUserAssignment,
  getUsersByIds,
} from "@/lib/server-user-management";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; assignmentId: string }>;
}): Promise<Metadata> {
  const { assignmentId } = await params;
  const assignment = await getAssignmentMetadata(assignmentId);
  const user = assignment ? await getPlayerMetadata(assignment.userId) : undefined;
  return {
    title: user ? `${user.name} ${getDictionary("en").userManagement.assignmentTitleSuffix}` : getDictionary("en").userManagement.editAssignment,
    description: getDictionary("en").userManagement.assignmentMetaDescription,
  };
}

export function generateStaticParams() {
  return [{ assignmentId: "sample-assignment" }];
}

export default async function ServerUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string; assignmentId: string }>;
}) {
  const { locale, serverId, assignmentId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const context = await getServerContext(serverId);
  if (!context) return null;
  const { server, groups = [], assignments } = context;

  const assignment = await getServerUserAssignment(assignmentId);
  const users = assignment ? await getUsersByIds([assignment.userId]) : [];
  const user = users[0];
  const eligibleUsers = await getEligibleUsersForServer(server, assignments);

  if (!assignment || !user) return null;

  return (
    <>
      <PageHeader
        title={user.name}
        description={dictionary.userManagement.assignmentDescription}
      />
      <div className="px-4 lg:px-6">
        <UserAssignmentForm locale={safeLocale} server={server} dictionary={dictionary} eligibleUsers={eligibleUsers} groups={groups} assignment={assignment} />
      </div>
    </>
  );
}
