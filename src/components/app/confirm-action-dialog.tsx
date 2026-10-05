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
            <DialogContent className="rounded-2xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description ? (
                        <DialogDescription>{description}</DialogDescription>
                    ) : null}
                </DialogHeader>
                {children}
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        disabled={isRunning}
                        onClick={() => setOpen(false)}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        type="button"
                        variant={destructive ? "destructive" : "default"}
                        className="rounded-xl"
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
