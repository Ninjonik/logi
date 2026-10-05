"use client"

import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    validateCalendarItemInput,
    type CalendarItemRangeError,
} from "@/domain/calendar/calendar-display"
import { fromDateTimeLocalInTimeZone } from "@/lib/timezone-datetime"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

type Field = "title" | "startAt" | "endAt"

/** A `datetime-local` value read as wall-clock time in the clan time zone. */
function toInstant(value: string, timezone: string | undefined) {
    if (!value) return null
    const instant = timezone
        ? fromDateTimeLocalInTimeZone(value, timezone)
        : new Date(value).toISOString()
    return Number.isNaN(Date.parse(instant)) ? null : instant
}

export function CalendarItemCreateDialog({
    serverId,
    dictionary,
    timezone,
}: {
    serverId: string
    dictionary: Dictionary
    /** The clan time zone; the entered times are wall-clock times there. */
    timezone?: string
}) {
    const router = useRouter()
    const labels = dictionary.calendarPage
    const [title, setTitle] = useState("")
    const [startAt, setStartAt] = useState("")
    const [endAt, setEndAt] = useState("")
    const [open, setOpen] = useState(false)
    const [pending, setPending] = useState(false)
    const [errors, setErrors] = useState<
        Partial<Record<Field, CalendarItemRangeError>>
    >({})

    const messages: Record<CalendarItemRangeError, string> = {
        title_required: labels.titleRequired,
        start_required: labels.startRequired,
        end_required: labels.endRequired,
        end_before_start: labels.endBeforeStart,
    }

    async function submit() {
        const startInstant = toInstant(startAt, timezone)
        const endInstant = toInstant(endAt, timezone)
        const nextErrors = validateCalendarItemInput({
            title,
            startAt: startInstant,
            endAt: endInstant,
        })
        setErrors(nextErrors)
        if (Object.keys(nextErrors).length || !startInstant || !endInstant)
            return

        setPending(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/calendar-items`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        title: title.trim(),
                        startAt: startInstant,
                        endAt: endInstant,
                    }),
                }
            ).catch(() => null)
            if (!response?.ok) {
                toast.error(labels.itemCreateFailed)
                return
            }
            toast.success(labels.itemCreated)
            setOpen(false)
            setTitle("")
            setStartAt("")
            setEndAt("")
            router.refresh()
        } finally {
            setPending(false)
        }
    }

    function fieldError(field: Field) {
        const error = errors[field]
        return error ? (
            <p
                id={`calendar-item-${field}-error`}
                className="text-destructive text-sm"
            >
                {messages[error]}
            </p>
        ) : null
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (pending) return
                setOpen(next)
                if (!next) setErrors({})
            }}
        >
            <DialogTrigger asChild>
                <Button className="rounded-xl">
                    <Plus className="size-4" />
                    {dictionary.serverSettings.addCalendarItem}
                </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {dictionary.serverSettings.addCalendarItem}
                    </DialogTitle>
                    {timezone ? (
                        <DialogDescription>
                            {labels.timezoneHint.replace(
                                "{timezone}",
                                timezone
                            )}
                        </DialogDescription>
                    ) : null}
                </DialogHeader>
                <form
                    className="space-y-4"
                    noValidate
                    onSubmit={(event) => {
                        event.preventDefault()
                        void submit()
                    }}
                >
                    <div className="space-y-2">
                        <Label htmlFor="calendar-item-title">
                            {dictionary.serverSettings.calendarItemTitle}
                        </Label>
                        <Input
                            id="calendar-item-title"
                            value={title}
                            aria-invalid={Boolean(errors.title)}
                            aria-describedby={
                                errors.title
                                    ? "calendar-item-title-error"
                                    : undefined
                            }
                            onChange={(event) => setTitle(event.target.value)}
                        />
                        {fieldError("title")}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="calendar-item-startAt">
                            {dictionary.serverSettings.calendarItemStart}
                        </Label>
                        <Input
                            id="calendar-item-startAt"
                            type="datetime-local"
                            value={startAt}
                            aria-invalid={Boolean(errors.startAt)}
                            aria-describedby={
                                errors.startAt
                                    ? "calendar-item-startAt-error"
                                    : undefined
                            }
                            onChange={(event) => setStartAt(event.target.value)}
                        />
                        {fieldError("startAt")}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="calendar-item-endAt">
                            {dictionary.serverSettings.calendarItemEnd}
                        </Label>
                        <Input
                            id="calendar-item-endAt"
                            type="datetime-local"
                            value={endAt}
                            min={startAt || undefined}
                            aria-invalid={Boolean(errors.endAt)}
                            aria-describedby={
                                errors.endAt
                                    ? "calendar-item-endAt-error"
                                    : undefined
                            }
                            onChange={(event) => setEndAt(event.target.value)}
                        />
                        {fieldError("endAt")}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl"
                            disabled={pending}
                            onClick={() => setOpen(false)}
                        >
                            {dictionary.common.cancel}
                        </Button>
                        <Button
                            type="submit"
                            className="rounded-xl"
                            disabled={pending}
                        >
                            {dictionary.common.create}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
