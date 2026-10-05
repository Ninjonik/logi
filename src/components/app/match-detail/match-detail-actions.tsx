"use client"

import { ExternalLink, MoreHorizontal } from "lucide-react"
import Link from "next/link"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type MatchDetailAction = {
    label: string
    href: string
    external?: boolean
    /** Shown only in the menu on phones, where the header has no room. */
    phoneOnly?: boolean
}

/** The "⋯" button of the match header (design D3, E2): secondary actions. */
export function MatchDetailActions({
    label,
    actions,
    className,
}: {
    label: string
    actions: MatchDetailAction[]
    className?: string
}) {
    if (actions.length === 0) return null
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    aria-label={label}
                    title={label}
                    className={cn("size-9 rounded-xl", className)}
                >
                    <MoreHorizontal className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
                {actions.map((action) => (
                    <DropdownMenuItem
                        key={action.href + action.label}
                        asChild
                        className={cn(action.phoneOnly && "sm:hidden")}
                    >
                        {action.external ? (
                            <a
                                href={action.href}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {action.label}
                                <ExternalLink className="ml-auto size-3.5" />
                            </a>
                        ) : (
                            <Link href={action.href}>{action.label}</Link>
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
