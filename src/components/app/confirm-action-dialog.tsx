"use client"

import { useState, type ReactNode } from "react"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/**
 * Confirmation before an action that cannot be undone (design K4): a question
 * as the title, what will happen, an optional summary of the consequences and
 * the action named on the confirm button. The dialog stays open while the
 * action runs and closes once it settles.
 */
export function ConfirmActionDialog({
    trigger,
    open: controlledOpen,
    onOpenChange,
    title,
    description,
    children,
    confirmLabel,
    cancelLabel,
    destructive = true,
    onConfirm,
}: {
    /** The button that opens the dialog; omit it to control `open` yourself. */
    trigger?: ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    title: string
    description?: string
    /** Optional summary of the consequences, shown between text and buttons. */
    children?: ReactNode
    confirmLabel: string
    cancelLabel: string
    destructive?: boolean
    /** Return false to keep the dialog open, for example after a failed request. */
    onConfirm: () => Promise<boolean | void> | boolean | void
}) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
    const [isRunning, setIsRunning] = useState(false)
    const open = controlledOpen ?? uncontrolledOpen

    function setOpen(next: boolean) {
        if (isRunning) return
        if (controlledOpen === undefined) setUncontrolledOpen(next)
        onOpenChange?.(next)
    }

    async function confirm() {
        setIsRunning(true)
        let keepOpen = false
        try {
            keepOpen = (await onConfirm()) === false
        } finally {
            setIsRunning(false)
        }
        if (!keepOpen) {
            if (controlledOpen === undefined) setUncontrolledOpen(false)
            onOpenChange?.(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
            <DialogContent
                showCloseButton={false}
                className="gap-3.5 rounded-[14px] p-[22px] sm:max-w-md"
            >
                <DialogHeader className="gap-3.5 text-left">
                    <DialogTitle className="text-[17px] leading-6">
                        {title}
                    </DialogTitle>
                    {description ? (
                        <DialogDescription className="text-foreground/80 leading-5">
                            {description}
                        </DialogDescription>
                    ) : null}
                </DialogHeader>
                {children}
                <DialogFooter className="flex-row justify-end gap-2 pt-1.5">
                    <Button
                        type="button"
                        variant="outline"
                        className="rounded-lg"
                        disabled={isRunning}
                        onClick={() => setOpen(false)}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        type="button"
                        variant={destructive ? "destructive" : "default"}
                        className="rounded-lg"
                        disabled={isRunning}
                        onClick={confirm}
                    >
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
