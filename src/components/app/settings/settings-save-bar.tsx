"use client"

import { Button } from "@/components/ui/button"

/**
 * The save bar at the bottom of a settings form: what saving touches, discard
 * and save. It stays in view while the form scrolls.
 */
export function SettingsSaveBar({
    note,
    dirty,
    saving,
    discardLabel,
    saveLabel,
    unsavedLabel,
    onDiscard,
    onSave,
}: {
    note: string
    dirty: boolean
    saving: boolean
    discardLabel: string
    saveLabel: string
    unsavedLabel: string
    onDiscard(): void
    onSave(): void
}) {
    return (
        <div className="border-border/60 bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 -mx-1 flex flex-col gap-3 rounded-2xl border p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm" aria-live="polite">
                {dirty ? (
                    <span className="text-foreground font-medium">
                        {unsavedLabel} ·{" "}
                    </span>
                ) : null}
                {note}
            </p>
            <div className="flex shrink-0 gap-2">
                <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-xl sm:flex-none"
                    disabled={!dirty || saving}
                    onClick={onDiscard}
                >
                    {discardLabel}
                </Button>
                <Button
                    type="button"
                    className="flex-1 rounded-xl sm:flex-none"
                    disabled={saving}
                    onClick={onSave}
                >
                    {saveLabel}
                </Button>
            </div>
        </div>
    )
}
