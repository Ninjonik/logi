"use client"

import { useId, useState } from "react"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export function CustomLoginLink({
    url,
    label,
    dictionary,
}: {
    url: string
    label: string
    dictionary: Dictionary
}) {
    const [copied, setCopied] = useState(false)
    const id = useId()
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex gap-2">
                <Input id={id} value={url} readOnly className="min-w-0" />
                <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                        await navigator.clipboard.writeText(url)
                        setCopied(true)
                        window.setTimeout(() => setCopied(false), 1600)
                    }}
                >
                    {copied
                        ? dictionary.serverSettings.copiedLoginUrl
                        : dictionary.serverSettings.copyLoginUrl}
                </Button>
            </div>
        </div>
    )
}
