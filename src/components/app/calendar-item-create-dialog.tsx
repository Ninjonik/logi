"use client"

import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export function CalendarItemCreateDialog({
    serverId,
    dictionary,
}: {
    serverId: string
    dictionary: Dictionary
}) {
    const router = useRouter()
    const [title, setTitle] = useState("")
    const [startAt, setStartAt] = useState("")
    const [endAt, setEndAt] = useState("")
    const [open, setOpen] = useState(false)
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="rounded-xl">
                    <Plus className="size-4" />
                    {dictionary.serverSettings.addCalendarItem}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {dictionary.serverSettings.addCalendarItem}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>
                            {dictionary.serverSettings.calendarItemTitle}
                        </Label>
                        <Input
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>
                            {dictionary.serverSettings.calendarItemStart}
                        </Label>
                        <Input
                            type="datetime-local"
                            value={startAt}
                            onChange={(event) => setStartAt(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>
                            {dictionary.serverSettings.calendarItemEnd}
                        </Label>
                        <Input
                            type="datetime-local"
                            value={endAt}
                            onChange={(event) => setEndAt(event.target.value)}
                        />
                    </div>
                    <Button
                        disabled={!title.trim() || !startAt || !endAt}
                        onClick={async () => {
                            const response = await fetch(
                                `/api/servers/${serverId}/calendar-items`,
                                {
                                    method: "POST",
                                    headers: {
                                        "content-type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        title,
                                        startAt: new Date(
                                            startAt
                                        ).toISOString(),
                                        endAt: new Date(endAt).toISOString(),
                                    }),
                                }
                            )
                            if (!response.ok)
                                return toast.error(dictionary.common.error)
                            setOpen(false)
                            router.refresh()
                        }}
                    >
                        {dictionary.common.create}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
