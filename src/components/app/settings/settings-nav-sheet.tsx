"use client"

import { useState, type ReactNode } from "react"
import { Menu } from "lucide-react"

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

/** On phones the settings menu opens from a button (design K2). */
export function SettingsNavSheet({
    label,
    title,
    children,
}: {
    label: string
    title: string
    children: ReactNode
}) {
    const [open, setOpen] = useState(false)
    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                >
                    <Menu className="size-4" aria-hidden="true" />
                    {label}
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                </SheetHeader>
                <div
                    className="px-2 pb-6"
                    onClick={(event) => {
                        if ((event.target as HTMLElement).closest("a"))
                            setOpen(false)
                    }}
                >
                    {children}
                </div>
            </SheetContent>
        </Sheet>
    )
}
