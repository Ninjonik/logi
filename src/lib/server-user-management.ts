import { mockUsers } from "@/lib/mock-data";
import type { AppUser, Guild } from "@/types/domain";

export type ServerUserAssignment = {
  id: string;
  userId: string;
  serverId: string;
  type: "member" | "mercenary";
  group?: string;
  paused: boolean;
  pausedNote?: string;
  createdAt: string;
  updatedAt: string;
};

export const mockServerUserAssignments: ServerUserAssignment[] = [
  {
    id: "assign-82ad-clover",
    userId: "210000000000001",
    serverId: "82ad",
    type: "member",
    group: "Command",
    paused: false,
    createdAt: "2026-02-01T12:00:00.000Z",
    updatedAt: "2026-07-06T18:00:00.000Z",
  },
  {
    id: "assign-82ad-swellboy",
    userId: "210000000000002",
    serverId: "82ad",
    type: "member",
    group: "Infantry",
    paused: false,
    createdAt: "2026-02-11T12:00:00.000Z",
    updatedAt: "2026-07-06T18:00:00.000Z",
  },
  {
    id: "assign-82ad-mjolk",
    userId: "210000000000003",
    serverId: "82ad",
    type: "member",
    group: "Recon",
    paused: true,
    pausedNote: "Inactive until campaign relaunch.",
    createdAt: "2026-03-02T12:00:00.000Z",
    updatedAt: "2026-07-06T18:00:00.000Z",
  },
  {
    id: "assign-82ad-luca",
    userId: "210000000000004",
    serverId: "82ad",
    type: "mercenary",
    group: "Merc Pool",
    paused: false,
    createdAt: "2026-03-20T12:00:00.000Z",
    updatedAt: "2026-07-06T18:00:00.000Z",
  },
];

export function getServerUserAssignments(serverId: string) {
  return mockServerUserAssignments.filter((assignment) => assignment.serverId === serverId);
}

export function getServerUserAssignment(serverId: string, assignmentId: string) {
  return mockServerUserAssignments.find(
    (assignment) => assignment.serverId === serverId && assignment.id === assignmentId,
  );
}

export function getAssignmentUser(assignment: ServerUserAssignment) {
  return mockUsers.find((user) => user.id === assignment.userId);
}

export function getEligibleUsersForServer(server: Guild, assignments: ServerUserAssignment[]) {
  return mockUsers.map((user) => {
    const existingHere = assignments.find((assignment) => assignment.userId === user.id);
    const canJoinAsMember = (!user.guildId || user.guildId === server.id) && existingHere?.type !== "mercenary";
    const canJoinAsMercenary = existingHere?.type !== "member";

    return {
      user,
      existingHere,
      canJoinAsMember,
      canJoinAsMercenary,
    };
  });
}
