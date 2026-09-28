"use client"

import { Button } from "@/components/ui/button"
import { useState, useTransition } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export function PlatformSettingsForm({
    workspaces,
    initialWorkspaceGuildId,
    initialStatusChannelId,
    labels,
}: {
    workspaces: Array<{ id: string; name: string }>
    initialWorkspaceGuildId?: string
    initialStatusChannelId?: string
    labels: {
        workspace: string
        channel: string
        hint: string
        save: string
        saved: string
    }
}) {
    const [workspaceGuildId, setWorkspaceGuildId] = useState(
        initialWorkspaceGuildId ?? ""
    )
    const [statusChannelId, setStatusChannelId] = useState(
        initialStatusChannelId ?? ""
    )
    const [pending, startTransition] = useTransition()
    return (
        <form
            className="space-y-6"
            onSubmit={(event) => {
                event.preventDefault()
                startTransition(async () => {
                    const response = await fetch(
                        "/api/superadmin/platform-settings",
                        {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                                workspaceGuildId,
                                statusChannelId,
                            }),
                        }
                    )
                    if (!response.ok) {
                        toast.error(
                            (await response.json()).error ??
                                "Unable to save platform settings."
                        )
                        return
                    }
                    toast.success(labels.saved)
                })
            }}
        >
            <div className="space-y-2">
                <Label htmlFor="platform-workspace">{labels.workspace}</Label>
                <select
                    id="platform-workspace"
                    value={workspaceGuildId}
                    onChange={(event) =>
                        setWorkspaceGuildId(event.target.value)
                    }
                    className="border-input flex h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                    <option value="" />
                    {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                            {workspace.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="platform-status-channel">
                    {labels.channel}
                </Label>
                <Input
                    id="platform-status-channel"
                    value={statusChannelId}
                    onChange={(event) => setStatusChannelId(event.target.value)}
                />
                <p className="text-muted-foreground text-sm">{labels.hint}</p>
            </div>
            <Button type="submit" disabled={pending || !workspaceGuildId}>
                {labels.save}
            </Button>
        </form>
    )
}
