"use client"

import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { AppWindow, Copy, Plus, Trash2, X } from "lucide-react"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

type Application = {
    clientId: string
    name: string
    websiteUrl: string
    redirectUris: string[]
}

function hostOf(url: string) {
    try {
        return new URL(url).host
    } catch {
        return url
    }
}

export function SsoApplications({
    serverId,
    dictionary,
    title,
}: {
    serverId: string
    dictionary: Dictionary
    /** Heading shown beside the add button. */
    title?: string
}) {
    const copy = dictionary.integrationSettings.sso
    const id = useId()
    const [applications, setApplications] = useState<Application[] | null>(null)
    const [formOpen, setFormOpen] = useState(false)
    const [name, setName] = useState("")
    const [websiteUrl, setWebsiteUrl] = useState("")
    const [redirectUri, setRedirectUri] = useState("")
    const [secret, setSecret] = useState<string | null>(null)
    useEffect(() => {
        fetch(`/api/servers/${serverId}/sso-applications`)
            .then((r) => r.json())
            .then((value: unknown) =>
                setApplications(Array.isArray(value) ? value : [])
            )
            .catch(() => setApplications([]))
    }, [serverId])
    const redirectUris = redirectUri
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean)
    async function create() {
        const response = await fetch(
            `/api/servers/${serverId}/sso-applications`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ name, websiteUrl, redirectUris }),
            }
        )
        const body = await response.json().catch(() => ({}))
        if (!response.ok)
            return toast.error(body.error ?? dictionary.common.error)
        setApplications((current) => [
            ...(current ?? []),
            { clientId: body.clientId, name, websiteUrl, redirectUris },
        ])
        setSecret(body.clientSecret)
        setName("")
        setWebsiteUrl("")
        setRedirectUri("")
        setFormOpen(false)
    }
    async function remove(clientId: string) {
        const response = await fetch(
            `/api/servers/${serverId}/sso-applications/${clientId}`,
            { method: "DELETE" }
        )
        if (!response.ok) {
            toast.error(dictionary.common.error)
            return false
        }
        setApplications((current) =>
            (current ?? []).filter(
                (application) => application.clientId !== clientId
            )
        )
        return true
    }
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                {title ? (
                    <h3 className="text-sm font-medium">{title}</h3>
                ) : (
                    <span />
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-lg font-normal"
                    aria-expanded={formOpen}
                    aria-controls={`${id}-form`}
                    onClick={() => setFormOpen((open) => !open)}
                >
                    {formOpen ? (
                        <X aria-hidden="true" />
                    ) : (
                        <Plus aria-hidden="true" />
                    )}
                    {formOpen
                        ? dictionary.integrationSettings.web.closeForm
                        : dictionary.integrationSettings.web.addApplication}
                </Button>
            </div>
            {secret ? (
                <div
                    className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                    role="status"
                >
                    <p className="font-medium">
                        {dictionary.serverSettings.ssoSecret}
                    </p>
                    <div className="flex gap-2">
                        <code className="bg-background min-w-0 flex-1 overflow-x-auto rounded p-2 text-xs">
                            {secret}
                        </code>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                void navigator.clipboard.writeText(secret)
                            }
                        >
                            <Copy />
                            {dictionary.serverSettings.copyLoginUrl}
                        </Button>
                    </div>
                </div>
            ) : null}
            {formOpen ? (
                <form
                    id={`${id}-form`}
                    className="space-y-3 rounded-xl border p-4"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void create()
                    }}
                >
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-name`}>
                                {dictionary.serverSettings.ssoName}
                            </Label>
                            <Input
                                id={`${id}-name`}
                                value={name}
                                required
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-website`}>
                                {dictionary.serverSettings.ssoWebsiteUrl}
                            </Label>
                            <Input
                                id={`${id}-website`}
                                type="url"
                                required
                                placeholder="https://example.com"
                                value={websiteUrl}
                                onChange={(e) => setWebsiteUrl(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-redirects`}>
                            {dictionary.serverSettings.ssoRedirectUris}
                        </Label>
                        <Textarea
                            id={`${id}-redirects`}
                            rows={2}
                            placeholder="https://example.com/auth/logi/callback"
                            value={redirectUri}
                            onChange={(e) => setRedirectUri(e.target.value)}
                        />
                    </div>
                    <Button type="submit">
                        <Plus />
                        {dictionary.serverSettings.ssoCreate}
                    </Button>
                </form>
            ) : null}
            {applications?.length === 0 && !formOpen ? (
                <EmptyState
                    icon={AppWindow}
                    title={copy.emptyTitle}
                    description={copy.emptyDescription}
                />
            ) : null}
            {applications?.length ? (
                <ul className="divide-y rounded-xl border">
                    {applications.map((application) => (
                        <ApplicationRow
                            key={application.clientId}
                            serverId={serverId}
                            application={application}
                            dictionary={dictionary}
                            onSaved={(next) =>
                                setApplications((current) =>
                                    (current ?? []).map((item) =>
                                        item.clientId === next.clientId
                                            ? next
                                            : item
                                    )
                                )
                            }
                            onRemove={() => remove(application.clientId)}
                        />
                    ))}
                </ul>
            ) : null}
        </div>
    )
}

const urlLines = (value: string) =>
    value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)

/**
 * One single sign-on application (design G5): its website and how many
 * return addresses it has, with an editor for name, website and addresses.
 * The client ID stays and the secret is never shown again.
 */
function ApplicationRow({
    serverId,
    application,
    dictionary,
    onSaved,
    onRemove,
}: {
    serverId: string
    application: Application
    dictionary: Dictionary
    onSaved(application: Application): void
    onRemove(): Promise<boolean>
}) {
    const copy = dictionary.integrationSettings.sso
    const id = useId()
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [name, setName] = useState(application.name)
    const [websiteUrl, setWebsiteUrl] = useState(application.websiteUrl)
    const [redirects, setRedirects] = useState(
        application.redirectUris.join("\n")
    )
    function reset() {
        setName(application.name)
        setWebsiteUrl(application.websiteUrl)
        setRedirects(application.redirectUris.join("\n"))
        setEditing(false)
    }
    async function save() {
        const next = {
            name: name.trim(),
            websiteUrl: websiteUrl.trim(),
            redirectUris: [...new Set(urlLines(redirects))],
        }
        setSaving(true)
        try {
            const response = await fetch(
                `/api/servers/${encodeURIComponent(serverId)}/sso-applications/${encodeURIComponent(application.clientId)}`,
                {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(next),
                }
            )
            const body = (await response.json().catch(() => ({}))) as {
                error?: string
            }
            if (!response.ok) {
                toast.error(body.error ?? dictionary.common.error)
                return
            }
            onSaved({ ...application, ...next })
            setEditing(false)
            toast.success(copy.saved)
        } catch {
            toast.error(dictionary.common.error)
        } finally {
            setSaving(false)
        }
    }
    return (
        <li className="space-y-4 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="break-words">{application.name}</p>
                    <p className="text-muted-foreground text-[13px] break-all">
                        {hostOf(application.websiteUrl)} ·{" "}
                        {copy.redirects.replace(
                            "{count}",
                            String(application.redirectUris.length)
                        )}
                    </p>
                </div>
                {editing ? null : (
                    <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        aria-label={`${copy.edit}: ${application.name}`}
                        onClick={() => setEditing(true)}
                    >
                        {copy.edit}
                    </Button>
                )}
            </div>
            {editing ? (
                <form
                    className="space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void save()
                    }}
                >
                    <fieldset disabled={saving} className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor={`${id}-name`}>
                                    {dictionary.serverSettings.ssoName}
                                </Label>
                                <Input
                                    id={`${id}-name`}
                                    value={name}
                                    required
                                    maxLength={100}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`${id}-website`}>
                                    {dictionary.serverSettings.ssoWebsiteUrl}
                                </Label>
                                <Input
                                    id={`${id}-website`}
                                    type="url"
                                    required
                                    value={websiteUrl}
                                    onChange={(e) =>
                                        setWebsiteUrl(e.target.value)
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-redirects`}>
                                {dictionary.serverSettings.ssoRedirectUris}
                            </Label>
                            <Textarea
                                id={`${id}-redirects`}
                                rows={3}
                                value={redirects}
                                onChange={(e) => setRedirects(e.target.value)}
                            />
                            <p className="text-muted-foreground text-xs break-all">
                                {copy.clientId}:{" "}
                                <code>{application.clientId}</code>
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="submit" size="sm">
                                {copy.save}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={reset}
                            >
                                {dictionary.integrationSettings.cancel}
                            </Button>
                            <ConfirmActionDialog
                                trigger={
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive ml-auto"
                                        aria-label={`${dictionary.serverSettings.ssoRemove}: ${application.name}`}
                                    >
                                        <Trash2 aria-hidden="true" />
                                        {dictionary.serverSettings.ssoRemove}
                                    </Button>
                                }
                                title={copy.removeTitle.replace(
                                    "{name}",
                                    application.name
                                )}
                                description={copy.removeDescription.replace(
                                    "{website}",
                                    hostOf(application.websiteUrl)
                                )}
                                confirmLabel={copy.removeConfirm}
                                cancelLabel={
                                    dictionary.integrationSettings.cancel
                                }
                                onConfirm={onRemove}
                            />
                        </div>
                    </fieldset>
                </form>
            ) : null}
        </li>
    )
}
