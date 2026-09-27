"use client"

import { useState } from "react"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function CustomLoginLink({
    url,
    dictionary,
}: {
    url: string
    dictionary: Dictionary
}) {
    const [copied, setCopied] = useState(false)
    return (
        <div className="flex gap-2">
            <Input value={url} readOnly />
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
    )
}
