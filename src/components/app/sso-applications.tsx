"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Dictionary } from "@/i18n/dictionaries"
import { Copy, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type Application = {
    clientId: string
    name: string
    websiteUrl: string
    redirectUris: string[]
}
export function SsoApplications({
    serverId,
    dictionary,
}: {
    serverId: string
    dictionary: Dictionary
}) {
    const [applications, setApplications] = useState<Application[]>([])
    const [name, setName] = useState("")
    const [websiteUrl, setWebsiteUrl] = useState("")
    const [redirectUri, setRedirectUri] = useState("")
    const [secret, setSecret] = useState<string | null>(null)
    useEffect(() => {
        fetch(`/api/servers/${serverId}/sso-applications`)
            .then((r) => r.json())
            .then(setApplications)
            .catch(() => setApplications([]))
    }, [serverId])
    async function create() {
        const response = await fetch(
            `/api/servers/${serverId}/sso-applications`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    name,
                    websiteUrl,
                    redirectUris: redirectUri
                        .split("\n")
                        .map((value) => value.trim())
                        .filter(Boolean),
                }),
            }
        )
        const body = await response.json()
        if (!response.ok)
            return toast.error(body.error ?? dictionary.common.error)
        setApplications((current) => [
            ...current,
            {
                clientId: body.clientId,
                name,
                websiteUrl,
                redirectUris: redirectUri.split("\n").filter(Boolean),
            },
        ])
        setSecret(body.clientSecret)
        setName("")
        setWebsiteUrl("")
        setRedirectUri("")
    }
    async function remove(clientId: string) {
        const response = await fetch(
            `/api/servers/${serverId}/sso-applications/${clientId}`,
            { method: "DELETE" }
        )
        if (!response.ok) return toast.error(dictionary.common.error)
        setApplications((current) =>
            current.filter((application) => application.clientId !== clientId)
        )
    }
    return (
        <Card>
            <CardHeader>
                <CardTitle>{dictionary.serverSettings.ssoTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">
                    {dictionary.serverSettings.ssoDescription}
                </p>
                {secret ? (
                    <div className="rounded-md border p-3 text-sm">
                        <p className="mb-1 font-medium">
                            {dictionary.serverSettings.ssoSecret}
                        </p>
                        <code className="break-all">{secret}</code>
                        <Button
                            className="ml-2"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                navigator.clipboard.writeText(secret)
                            }
                        >
                            <Copy />
                            {dictionary.serverSettings.copyLoginUrl}
                        </Button>
                    </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                    <div>
                        <Label>{dictionary.serverSettings.ssoName}</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>{dictionary.serverSettings.ssoWebsiteUrl}</Label>
                        <Input
                            placeholder="https://example.com"
                            value={websiteUrl}
                            onChange={(e) => setWebsiteUrl(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                    <Label>{dictionary.serverSettings.ssoRedirectUris}</Label>
                    <Input
                        placeholder="https://example.com/auth/logi/callback"
                        value={redirectUri}
                        onChange={(e) => setRedirectUri(e.target.value)}
                    />
                </div>
                <Button onClick={create}>
                    <Plus />
                    {dictionary.serverSettings.ssoCreate}
                </Button>
                {applications.map((application) => (
                    <div
                        className="rounded-md border p-3 text-sm"
                        key={application.clientId}
                    >
                        <strong>{application.name}</strong>
                        <Button
                            className="float-right"
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(application.clientId)}
                            aria-label={dictionary.serverSettings.ssoRemove}
                        >
                            <Trash2 />
                        </Button>
                        <br />
                        Client ID: <code>{application.clientId}</code>
                        <br />
                        {application.redirectUris.join(", ")}
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
