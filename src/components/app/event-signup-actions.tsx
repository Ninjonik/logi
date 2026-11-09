"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogHeader,
} from "@/components/ui/dialog"
import { getEventMessages } from "@/lib/clan-language/events"
import { SIGNUP_NOT_ATTENDING } from "@/domain/events/types"
import { buildEventSignupActions } from "@/lib/event-signup"
import { isLateSignupWindow } from "@/domain/events/status"
import { EmojiValue } from "@/components/app/emoji-value"
import type { EventRecord, Group } from "@/types/domain"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function EventSignupActions({
    serverId,
    event,
    groups,
    signupLanguage,
    className,
}: {
    serverId: string
    event: EventRecord
    groups: Group[]
    signupLanguage: "en" | "cs" | "de" | "pl" | "fr"
    className?: string
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const messages = getEventMessages(signupLanguage)
    const actions = buildEventSignupActions(event, groups, messages.buttons)

    const [lateAction, setLateAction] = useState<string | null>(null)
    const [reason, setReason] = useState("")
    const [saving, setSaving] = useState(false)

    async function handleSignup(actionId: string, lateSignupReason?: string) {
        if (
            actionId !== SIGNUP_NOT_ATTENDING &&
            isLateSignupWindow(event) &&
            lateSignupReason === undefined
        ) {
            setReason("")
            setLateAction(actionId)
            return
        }
        setSaving(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/events/${event.id}/signup`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ actionId, lateSignupReason }),
                }
            )
            const body = await response.json()
            if (!response.ok) {
                toast.error(
                    body.error ?? messages.interaction.unableToLoadEventContext
                )
                return
            }

            if (body.warning) toast.warning(body.warning)
            else
                toast.success(
                    body.message ?? messages.interaction.signupUpdated
                )
            setLateAction(null)
            startTransition(() => router.refresh())
        } catch {
            toast.error(messages.interaction.unableToLoadEventContext)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className={cn("flex flex-wrap gap-2", className)}>
            <Dialog
                open={lateAction !== null}
                onOpenChange={(open) => {
                    if (!open && !saving) setLateAction(null)
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{messages.lateSignup.title}</DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            if (lateAction)
                                void handleSignup(lateAction, reason.trim())
                        }}
                        className="space-y-4"
                    >
                        <Label htmlFor="late-signup-reason">
                            {messages.lateSignup.reason}
                        </Label>
                        <Textarea
                            id="late-signup-reason"
                            required
                            maxLength={1000}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                        <Button
                            type="submit"
                            disabled={saving || !reason.trim()}
                        >
                            {messages.lateSignup.submit}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
            {actions.map((action) => (
                <Button
                    key={action.id}
                    type="button"
                    variant={
                        action.kind === "decline"
                            ? "destructive"
                            : action.kind === "general"
                              ? "default"
                              : "outline"
                    }
                    className="rounded-xl"
                    disabled={isPending || saving}
                    onClick={() => handleSignup(action.id)}
                    style={
                        action.kind === "group"
                            ? {
                                  borderColor: `${action.color}66`,
                                  color: action.color,
                                  backgroundColor: `${action.color}14`,
                              }
                            : undefined
                    }
                >
                    {action.kind === "general" ? <span>✅</span> : null}
                    {"emoji" in action && action.emoji ? (
                        <EmojiValue value={action.emoji} />
                    ) : null}
                    {action.label}
                </Button>
            ))}
        </div>
    )
}
