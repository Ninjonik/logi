"use client"

import {
    DiscordChannelSelect,
    type SelectableDiscordChannel,
} from "@/components/app/discord-channel-select"
import { useEffect, useState, useTransition } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export type PlatformWorkspaceOption = {
    /** Discord server ID. */
    id: string
    name: string
    botInside: boolean
}

type ChannelState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; channels: SelectableDiscordChannel[] }
    | { status: "error" }

/** The last channel listing, for the workspace and attempt it answers. */
type LoadedChannels = {
    key: string
    channels: SelectableDiscordChannel[] | null
}

export function PlatformSettingsForm({
    workspaces,
    initialWorkspaceGuildId,
    initialStatusChannelId,
    labels,
}: {
    workspaces: PlatformWorkspaceOption[]
    initialWorkspaceGuildId?: string
    initialStatusChannelId?: string
    labels: {
        workspace: string
        workspacePlaceholder: string
        workspaceHint: string
        workspaceBotMissing: string
        savedWorkspace: string
        channel: string
        channelPlaceholder: string
        channelNone: string
        channelsLoading: string
        channelsError: string
        channelsRetry: string
        chooseWorkspaceFirst: string
        hint: string
        save: string
        saved: string
        saveError: string
    }
}) {
    const [workspaceGuildId, setWorkspaceGuildId] = useState(
        initialWorkspaceGuildId ?? ""
    )
    const [statusChannelId, setStatusChannelId] = useState(
        initialStatusChannelId ?? ""
    )
    const [reload, setReload] = useState(0)
    const [loaded, setLoaded] = useState<LoadedChannels | null>(null)
    const [pending, startTransition] = useTransition()
    const withBot = workspaces.filter((workspace) => workspace.botInside)
    const selected = workspaces.find(
        (workspace) => workspace.id === workspaceGuildId
    )
    // A saved workspace that lost the bot stays selected and is named, so the
    // select never shows blank and the administrator sees why.
    const savedWithoutBot =
        workspaceGuildId !== "" && !selected?.botInside
            ? (selected?.name ??
              labels.savedWorkspace.replace("{id}", workspaceGuildId))
            : null
    const canList = workspaceGuildId !== "" && !savedWithoutBot
    const requestKey = `${workspaceGuildId}#${reload}`
    const channels: ChannelState = !canList
        ? { status: "idle" }
        : loaded?.key !== requestKey
          ? { status: "loading" }
          : loaded.channels
            ? { status: "ready", channels: loaded.channels }
            : { status: "error" }

    useEffect(() => {
        if (!canList) return
        const controller = new AbortController()
        fetch(
            `/api/superadmin/platform-settings/channels?guildId=${encodeURIComponent(workspaceGuildId)}`,
            { signal: controller.signal }
        )
            .then(async (response) => {
                const body = (await response.json().catch(() => null)) as {
                    channels?: SelectableDiscordChannel[]
                } | null
                if (!response.ok || !Array.isArray(body?.channels))
                    throw new Error("channels")
                setLoaded({ key: requestKey, channels: body.channels })
            })
            .catch(() => {
                if (!controller.signal.aborted)
                    setLoaded({ key: requestKey, channels: null })
            })
        return () => controller.abort()
    }, [canList, workspaceGuildId, requestKey])

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
                    ).catch(() => null)
                    if (!response?.ok) {
                        const body = (await response
                            ?.json()
                            .catch(() => null)) as { error?: unknown } | null
                        toast.error(
                            typeof body?.error === "string"
                                ? body.error
                                : labels.saveError
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
                    aria-describedby="platform-workspace-hint"
                    onChange={(event) => {
                        setWorkspaceGuildId(event.target.value)
                        setStatusChannelId("")
                    }}
                    className="border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm"
                >
                    <option value="" disabled>
                        {labels.workspacePlaceholder}
                    </option>
                    {savedWithoutBot ? (
                        <option value={workspaceGuildId}>
                            {savedWithoutBot}
                        </option>
                    ) : null}
                    {withBot.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                            {workspace.name}
                        </option>
                    ))}
                </select>
                <p
                    id="platform-workspace-hint"
                    className="text-muted-foreground text-sm"
                >
                    {labels.workspaceHint}
                </p>
                {savedWithoutBot ? (
                    <p
                        role="alert"
                        className="text-destructive flex items-start gap-2 text-sm"
                    >
                        <AlertTriangle
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden
                        />
                        {labels.workspaceBotMissing.replace(
                            "{name}",
                            savedWithoutBot
                        )}
                    </p>
                ) : null}
            </div>
            <fieldset className="space-y-2">
                <legend className="text-sm leading-none font-medium">
                    {labels.channel}
                </legend>
                {channels.status === "ready" ? (
                    <DiscordChannelSelect
                        value={statusChannelId || undefined}
                        onChange={(value) => setStatusChannelId(value ?? "")}
                        channels={channels.channels}
                        placeholder={labels.channelPlaceholder}
                        noneLabel={labels.channelNone}
                    />
                ) : channels.status === "loading" ? (
                    <p
                        role="status"
                        className="text-muted-foreground flex items-center gap-2 text-sm"
                    >
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        {labels.channelsLoading}
                    </p>
                ) : channels.status === "error" ? (
                    <div
                        role="alert"
                        className="flex flex-wrap items-center gap-3"
                    >
                        <p className="text-destructive text-sm">
                            {labels.channelsError}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setReload((value) => value + 1)}
                        >
                            {labels.channelsRetry}
                        </Button>
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        {labels.chooseWorkspaceFirst}
                    </p>
                )}
                <p className="text-muted-foreground text-sm">{labels.hint}</p>
            </fieldset>
            <Button
                type="submit"
                disabled={pending || !workspaceGuildId || !!savedWithoutBot}
            >
                {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {labels.save}
            </Button>
        </form>
    )
}
