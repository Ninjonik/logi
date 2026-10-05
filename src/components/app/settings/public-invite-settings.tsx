"use client"

import { useId, useState, useTransition } from "react"
import { ExternalLink } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { parseDiscordInviteUrl } from "@/domain/workspaces/public-clan-page"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

/**
 * Clan profile › the Discord invite behind "Join on Discord" on the public
 * clan page (design J2). Only Discord invite links are accepted; an empty
 * field removes the button.
 */
export function PublicInviteSettings({
    serverId,
    publicPageHref,
    inviteUrl,
    dictionary,
}: {
    serverId: string
    publicPageHref: string
    inviteUrl: string | null
    dictionary: Dictionary
}) {
    const t = dictionary.publicProfiles.inviteSettings
    const inputId = useId()
    const errorId = useId()
    const [value, setValue] = useState(inviteUrl ?? "")
    const [saved, setSaved] = useState(inviteUrl ?? "")
    const [invalid, setInvalid] = useState(false)
    const [isPending, startTransition] = useTransition()
    const dirty = value.trim() !== saved

    function save() {
        const trimmed = value.trim()
        const invite = trimmed ? parseDiscordInviteUrl(trimmed) : null
        if (trimmed && !invite) {
            setInvalid(true)
            return
        }
        setInvalid(false)
        startTransition(async () => {
            const response = await fetch(
                `/api/servers/${serverId}/public-invite`,
                {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ inviteUrl: invite }),
                }
            ).catch(() => null)
            if (!response?.ok) {
                if (response?.status === 400) setInvalid(true)
                toast.error(t.saveError)
                return
            }
            const body = (await response.json()) as {
                inviteUrl: string | null
            }
            setValue(body.inviteUrl ?? "")
            setSaved(body.inviteUrl ?? "")
            toast.success(body.inviteUrl ? t.saved : t.removed)
        })
    }

    return (
        <Card className="border-border/60 rounded-2xl">
            <CardHeader>
                <CardTitle>
                    <h3>{t.title}</h3>
                </CardTitle>
                <p className="text-muted-foreground text-sm">{t.description}</p>
            </CardHeader>
            <CardContent>
                {/* Validated here: the browser's URL check would refuse "discord.gg/…" without a scheme. */}
                <form
                    noValidate
                    className="space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault()
                        save()
                    }}
                >
                    <div className="space-y-2">
                        <Label htmlFor={inputId}>{t.label}</Label>
                        <Input
                            id={inputId}
                            type="url"
                            inputMode="url"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="https://discord.gg/…"
                            value={value}
                            maxLength={200}
                            aria-invalid={invalid || undefined}
                            aria-describedby={errorId}
                            onChange={(event) => {
                                setValue(event.target.value)
                                setInvalid(false)
                            }}
                            className="rounded-xl"
                        />
                        <p
                            id={errorId}
                            className={
                                invalid
                                    ? "text-destructive text-sm"
                                    : "text-muted-foreground text-sm"
                            }
                        >
                            {invalid ? t.invalid : t.help}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="submit"
                            className="rounded-xl"
                            disabled={isPending || !dirty}
                        >
                            {isPending ? t.saving : t.save}
                        </Button>
                        <Link
                            href={publicPageHref}
                            target="_blank"
                            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
                        >
                            {t.viewPublicPage}
                            <ExternalLink className="size-3.5" />
                        </Link>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
