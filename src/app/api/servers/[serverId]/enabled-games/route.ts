import { workspaceAdminActionHandlers } from "@/lib/api/workspace-admin-actions"

export async function POST(
    request: Request,
    context: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await context.params
    return workspaceAdminActionHandlers.setEnabledGames(request, serverId)
}
