"use client"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function ToggleRow({
    label,
    checked,
    onCheckedChange,
}: {
    label: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
}) {
    return (
        <div className="border-border/60 flex items-center justify-between rounded-lg border px-2.5 py-1.5">
            <Label className="text-xs">{label}</Label>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    )
}
