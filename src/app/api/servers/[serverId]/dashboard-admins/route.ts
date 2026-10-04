import { workspaceAdminActionHandlers } from "@/lib/api/workspace-admin-actions"

/** Rebuilds dashboard admin access from the current dashboard-role members. */
export async function POST(
    request: Request,
    context: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await context.params
    return workspaceAdminActionHandlers.resyncDashboardAdmins(request, serverId)
}
