import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { appCacheTags, tagCacheEntries } from "@/lib/cache-tags";

const listAssignmentsReference = makeFunctionReference<"query">("userAssignments:listForServer");
const getAssignmentByIdReference = makeFunctionReference<"query">("userAssignments:getById");

export type ServerUserAssignmentReadModel = {
  id: string;
  userId: string;
  serverId: string;
  type: "member" | "reserve_member" | "mercenary";
  status: "pending" | "recruit" | "active";
  membershipCategoryId?: string;
  primaryGroupId?: string;
  secondaryGroupIds: string[];
  paused: boolean;
  pausedNote?: string;
  createdAt: string;
  updatedAt: string;
};

export async function getServerUserAssignmentsReadModel(serverId: string): Promise<ServerUserAssignmentReadModel[]> {
  "use cache";
  tagCacheEntries([appCacheTags.assignments(serverId)]);
  return (await fetchQuery(listAssignmentsReference, { serverId })) as ServerUserAssignmentReadModel[];
}

export async function getServerUserAssignmentReadModel(assignmentId: string) {
  "use cache";
  tagCacheEntries([appCacheTags.assignment(assignmentId)]);
  return (await fetchQuery(getAssignmentByIdReference, {
    assignmentId: assignmentId as never,
  })) as ServerUserAssignmentReadModel | null;
}
