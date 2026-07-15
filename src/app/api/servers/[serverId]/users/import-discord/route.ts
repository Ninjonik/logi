import { NextResponse } from "next/server";

import { handleIfNotLoggedIn } from "@/lib/auth";
import { fetchDiscordGuildMembers, getDiscordAvatarUrl, type DiscordGuildMember } from "@/lib/discord";
import { getServerContext } from "@/lib/server-context";
import { importDiscordMembersForServer, getServerUserAssignments, listUsers } from "@/lib/server-user-management";

function canImportUserAsType(input: {
  assignmentType: "member" | "mercenary";
  serverDiscordId: string;
  user?: Awaited<ReturnType<typeof listUsers>>[number];
  existingAssignment?: Awaited<ReturnType<typeof getServerUserAssignments>>[number];
}) {
  if (input.existingAssignment) {
    return true;
  }

  if (input.assignmentType === "member") {
    return !input.user?.guildId || input.user.guildId === input.serverDiscordId;
  }

  return true;
}

function getDisplayName(member: DiscordGuildMember) {
  return member.nick?.trim() || member.user?.global_name?.trim() || member.user?.username?.trim() || member.user?.id || "Unknown";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;
  await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/users`);

  const context = await getServerContext(serverId);
  if (!context?.canAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const body = await request.json() as {
      roleId?: string;
      assignmentType?: "member" | "mercenary";
    };

    const roleId = String(body.roleId ?? "").trim();
    const assignmentType = body.assignmentType === "mercenary" ? "mercenary" : "member";

    if (!roleId) {
      return NextResponse.json({ error: "Role is required." }, { status: 400 });
    }

    const [discordMembers, existingUsers, existingAssignments] = await Promise.all([
      fetchDiscordGuildMembers(context.server.discordId),
      listUsers(),
      getServerUserAssignments(serverId),
    ]);

    const usersById = new Map(existingUsers.map((user) => [user.discordId, user]));
    const assignmentsByUserId = new Map(existingAssignments.map((assignment) => [assignment.userId, assignment]));
    const discordMappedGroups = context.groups.filter((group) => group.discordRoleId);

    let matchedMembers = 0;
    let skippedBots = 0;
    let skippedIneligible = 0;

    const membersToImport = discordMembers.flatMap((member) => {
      if (!member.user || member.user.bot) {
        skippedBots += member.user?.bot ? 1 : 0;
        return [];
      }

      if (!member.roles.includes(roleId)) {
        return [];
      }

      matchedMembers += 1;

      const existingUser = usersById.get(member.user.id);
      const existingAssignment = assignmentsByUserId.get(member.user.id);
      if (!canImportUserAsType({
        assignmentType,
        serverDiscordId: context.server.discordId,
        user: existingUser,
        existingAssignment,
      })) {
        skippedIneligible += 1;
        return [];
      }

      const secondaryGroupIds = discordMappedGroups
        .filter((group) => group.discordRoleId && member.roles.includes(group.discordRoleId))
        .map((group) => group.id);

      return [{
        userId: member.user.id,
        name: getDisplayName(member),
        avatar: getDiscordAvatarUrl({
          id: member.user.id,
          username: member.user.username,
          avatar: member.user.avatar,
        }),
        secondaryGroupIds,
      }];
    });

    if (membersToImport.length === 0) {
      return NextResponse.json({
        importedCount: 0,
        matchedMembers,
        skippedBots,
        skippedIneligible,
        createdUsers: 0,
        updatedUsers: 0,
        createdAssignments: 0,
        updatedAssignments: 0,
      });
    }

    const result = await importDiscordMembersForServer({
      serverId,
      assignmentType,
      members: membersToImport,
    });

    return NextResponse.json({
      ...result,
      matchedMembers,
      skippedBots,
      skippedIneligible,
    });
  } catch (error) {
    console.error("Failed to import Discord members", error);
    return NextResponse.json({ error: "Unable to import Discord members." }, { status: 500 });
  }
}
