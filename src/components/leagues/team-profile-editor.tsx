"use client"
import {
    precheckImageFile,
    readImageUploadResponse,
} from "@/lib/image-asset-upload"
import type { LeagueCommand, LeaguePortalTeam } from "@/domain/leagues/portal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getTeamManagementMessages } from "@/i18n/messages/team-management"
import { getLeagueMessages } from "@/i18n/messages/leagues"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { Locale } from "@/i18n/config"
import { useState } from "react"

export function TeamProfileEditor({
    team,
    locale,
    run,
    pending,
}: {
    team: LeaguePortalTeam
    locale: Locale
    run(input: LeagueCommand): Promise<boolean>
    pending: boolean
}) {
    const t = getLeagueMessages(locale),
        m = getTeamManagementMessages(locale)
    const [editing, setEditing] = useState(false)
    const [logo, setLogo] = useState({
        id: team.logoAssetId,
        url: team.logoUrl,
    })
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    if (!editing)
        return (
            <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
            >
                {m.edit}
            </Button>
        )
    return (
        <form
            className="space-y-4 rounded-xl border p-4"
            onSubmit={async (event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                if (
                    await run({
                        action: "updateTeam",
                        teamId: team.id,
                        expectedRevision: team.revision,
                        name: String(data.get("name") ?? ""),
                        shortCode:
                            String(data.get("shortCode") ?? "").trim() || null,
                        description:
                            String(data.get("description") ?? "").trim() ||
                            null,
                        logoAssetId: logo.id,
                    })
                )
                    setEditing(false)
            }}
        >
            <fieldset disabled={pending || uploading} className="space-y-4">
                <Label className="grid gap-2">
                    {t.name}
                    <Input
                        name="name"
                        required
                        maxLength={120}
                        defaultValue={team.name}
                    />
                </Label>
                <Label className="grid gap-2">
                    {t.shortCode}
                    <Input
                        name="shortCode"
                        maxLength={16}
                        defaultValue={team.shortCode ?? ""}
                    />
                </Label>
                <Label className="grid gap-2">
                    {t.about}
                    <Input
                        name="description"
                        maxLength={500}
                        defaultValue={team.description ?? ""}
                    />
                </Label>
                <div className="flex items-center gap-3">
                    <Avatar className="size-14 rounded-lg">
                        <AvatarImage src={logo.url ?? undefined} alt="" />
                        <AvatarFallback>{team.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLogo({ id: null, url: null })}
                    >
                        {m.removeAvatar}
                    </Button>
                </div>
                <Label className="grid gap-2">
                    {m.avatar}
                    <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={async (event) => {
                            const file = event.target.files?.[0]
                            if (!file) return
                            setError(null)
                            if (precheckImageFile(file)) {
                                setError(m.uploadError)
                                return
                            }
                            setUploading(true)
                            try {
                                const response = await fetch(
                                    `/api/v1/me/leagues/teams/${encodeURIComponent(team.id)}/logo?name=${encodeURIComponent(file.name)}`,
                                    {
                                        method: "POST",
                                        headers: { "Content-Type": file.type },
                                        body: file,
                                    }
                                )
                                const result = readImageUploadResponse(
                                    response.status,
                                    await response.json(),
                                    response.headers.get("Retry-After")
                                )
                                if (result.ok)
                                    setLogo({
                                        id: result.asset.id,
                                        url: result.asset.url,
                                    })
                                else
                                    setError(
                                        result.error === "forbidden"
                                            ? t.forbidden
                                            : result.error === "upload_limited"
                                              ? m.uploadRateLimit
                                              : m.uploadError
                                    )
                            } catch {
                                setError(m.uploadError)
                            } finally {
                                setUploading(false)
                            }
                        }}
                    />
                </Label>
                <p className="text-muted-foreground text-xs">{m.avatarHint}</p>
                {error && (
                    <p role="alert" className="text-destructive text-sm">
                        {error}
                    </p>
                )}
                <div className="flex gap-2">
                    <Button type="submit">
                        {uploading ? t.saving : t.save}
                    </Button>
                    <Button
                        variant="ghost"
                        type="button"
                        onClick={() => {
                            setEditing(false)
                            setLogo({ id: team.logoAssetId, url: team.logoUrl })
                            setError(null)
                        }}
                    >
                        {m.cancel}
                    </Button>
                </div>
            </fieldset>
        </form>
    )
}
