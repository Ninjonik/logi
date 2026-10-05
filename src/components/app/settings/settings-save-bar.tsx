"use client"

import { Button } from "@/components/ui/button"

/**
 * The save bar at the bottom of a settings form (designs F1, F2, G5): what
 * saving touches, discard and save. It stays in view while the form scrolls;
 * on phones it is a bar at the bottom of the screen (design K2).
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
        <div
            data-mobile-action-bar=""
            className="bg-muted/95 supports-[backdrop-filter]:bg-muted/80 max-sm:bg-background z-30 flex items-center justify-between gap-3 backdrop-blur max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:border-t max-sm:px-3.5 max-sm:pt-3 max-sm:pb-[max(1.125rem,env(safe-area-inset-bottom))] sm:sticky sm:bottom-0 sm:rounded-2xl sm:border sm:px-4 sm:py-3"
        >
            <p className="text-sm" aria-live="polite">
                {dirty ? (
                    <span className="font-medium">
                        {unsavedLabel}
                        <span className="max-sm:hidden"> · </span>
                    </span>
                ) : null}
                <span
                    className={
                        dirty
                            ? "text-muted-foreground max-sm:hidden"
                            : "text-muted-foreground"
                    }
                >
                    {note}
                </span>
            </p>
            <div className="flex shrink-0 gap-2">
                <Button
                    type="button"
                    variant="outline"
                    className="bg-background rounded-xl max-sm:hidden"
                    disabled={!dirty || saving}
                    onClick={onDiscard}
                >
                    {discardLabel}
                </Button>
                <Button
                    type="button"
                    className="rounded-xl max-sm:h-11 max-sm:px-6"
                    disabled={saving}
                    onClick={onSave}
                >
                    {saveLabel}
                </Button>
            </div>
        </div>
    )
}
