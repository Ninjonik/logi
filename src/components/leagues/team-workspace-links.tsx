"use client"

import type { LeaguePortalView } from "@/domain/leagues/portal"
import { getLeagueMessages } from "@/i18n/messages/leagues"
import { Button } from "@/components/ui/button"
import { useState, useTransition } from "react"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import type { Locale } from "@/i18n/config"
import { z } from "zod"

const resultSchema = z.union([
    z.object({ ok: z.literal(true) }),
    z.object({ error: z.string() }),
])

export function TeamWorkspaceLinks({
    view,
    locale,
    guildId,
    compact = false,
}: {
    view: LeaguePortalView
    locale: Locale
    compact?: boolean
    guildId?: string
}) {
    const t = getLeagueMessages(locale)
    const router = useRouter()
    const [busy, setBusy] = useState(false)
    const [refreshing, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const teams = view.teams.filter(
        (team) => team.accountOwner && !team.clanLinked
    )
    const workspaces = view.workspaces.filter(
        (workspace) =>
            !workspace.teamId && (!guildId || workspace.guildId === guildId)
    )
    if (!teams.length) return null
    return (
        <section className="bg-card space-y-4 rounded-xl border p-5">
            {!compact && (
                <h2 className="text-xl font-semibold">{t.linkTitle}</h2>
            )}
            {!compact && (
                <p className="text-muted-foreground text-sm leading-6">
                    {t.linkHint}
                </p>
            )}
            {error && (
                <p role="alert" className="text-destructive text-sm">
                    {error}
                </p>
            )}
            {!workspaces.length ? (
                <p className="text-muted-foreground text-sm">
                    {t.noWorkspaces}
                </p>
            ) : (
                teams.map((team) => (
                    <form
                        key={team.id}
                        onSubmit={async (event) => {
                            event.preventDefault()
                            const selected = new FormData(
                                event.currentTarget
                            ).get("guildId")
                            if (typeof selected !== "string" || !selected)
                                return
                            setBusy(true)
                            setError(null)
                            try {
                                const response = await fetch(
                                    "/api/v1/me/leagues",
                                    {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                            action: "linkTeam",
                                            teamId: team.id,
                                            guildId: selected,
                                        }),
                                    }
                                )
                                const result = resultSchema.safeParse(
                                    await response.json()
                                )
                                if (
                                    !response.ok ||
                                    !result.success ||
                                    "error" in result.data
                                ) {
                                    const code =
                                        result.success && "error" in result.data
                                            ? result.data.error
                                            : null
                                    setError(
                                        code === "guild_already_linked" ||
                                            code === "team_already_linked"
                                            ? t.linkConflict
                                            : code === "forbidden"
                                              ? t.forbidden
                                              : t.error
                                    )
                                } else startTransition(() => router.refresh())
                            } catch {
                                setError(t.error)
                            } finally {
                                setBusy(false)
                            }
                        }}
                    >
                        <fieldset
                            disabled={busy || refreshing}
                            className="flex flex-wrap items-end gap-3 border-t pt-4"
                        >
                            <div className="min-w-40 flex-1">
                                <p className="font-medium">{team.name}</p>
                                <p className="text-muted-foreground text-xs">
                                    {team.gameId === "wardogs"
                                        ? "Wardogs"
                                        : "Hell Let Loose"}
                                </p>
                            </div>
                            <Label className="grid gap-2">
                                {t.selectWorkspace}
                                <select
                                    required
                                    name="guildId"
                                    defaultValue={guildId ?? ""}
                                    className="bg-background h-10 max-w-full rounded-md border px-3 text-sm"
                                >
                                    <option value="">
                                        {t.chooseWorkspace}
                                    </option>
                                    {workspaces.map((workspace) => (
                                        <option
                                            key={workspace.guildId}
                                            value={workspace.guildId}
                                        >
                                            {workspace.name}
                                        </option>
                                    ))}
                                </select>
                            </Label>
                            <Button type="submit">{t.linkTeam}</Button>
                        </fieldset>
                    </form>
                ))
            )}
            {!compact && (
                <p className="text-muted-foreground text-xs">{t.manageLater}</p>
            )}
        </section>
    )
}
