"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { teamInitials } from "@/domain/teams/team"
import { cn } from "@/lib/utils"

/** Square team logo with the directory's initials fallback. */
export function TeamLogo({
    name,
    shortCode,
    logoUrl,
    className,
}: {
    name: string
    shortCode: string | null
    logoUrl: string | null
    className?: string
}) {
    return (
        <Avatar className={cn("rounded-lg", className)}>
            {logoUrl ? <AvatarImage src={logoUrl} alt="" /> : null}
            <AvatarFallback className="rounded-lg text-xs font-semibold">
                {teamInitials(name, shortCode) || "?"}
            </AvatarFallback>
        </Avatar>
    )
}
