import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { UserAssignmentForm } from "@/components/app/user-assignment-form";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getServerContext } from "@/lib/server-context";
import {
  getAssignmentUser,
  getEligibleUsersForServer,
  getServerUserAssignment,
  getServerUserAssignments,
} from "@/lib/server-user-management";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string; assignmentId: string }>;
}): Promise<Metadata> {
  const { serverId, assignmentId } = await params;
  const assignment = getServerUserAssignment(serverId, assignmentId);
  const user = assignment ? getAssignmentUser(assignment) : undefined;
  return {
    title: user ? `${user.name} assignment` : "User assignment",
    description: "Edit clan membership, mercenary role, group, and pause state.",
  };
}

export default async function ServerUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; serverId: string; assignmentId: string }>;
}) {
  const { locale, serverId, assignmentId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const { server } = getServerContext(serverId);
  if (!server) return null;

  const assignments = getServerUserAssignments(serverId);
  const assignment = getServerUserAssignment(serverId, assignmentId);
  const user = assignment ? getAssignmentUser(assignment) : undefined;
  const eligibleUsers = getEligibleUsersForServer(server, assignments);

  if (!assignment || !user) return null;

  return (
    <>
      <PageHeader
        title={user.name}
        description="Edit assignment type, group, paused membership state, or remove the player from this server."
      />
      <div className="px-4 lg:px-6">
        <UserAssignmentForm server={server} dictionary={dictionary} eligibleUsers={eligibleUsers} assignment={assignment} />
      </div>
    </>
  );
}
