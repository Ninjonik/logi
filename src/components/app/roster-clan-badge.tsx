import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export type RosterClan = { guildId: string; name: string; avatar?: string }

/** Small clan identity beside player avatars; initials cover missing Discord icons. */
export function RosterClanBadge({
    clan,
    className,
}: {
    clan?: RosterClan
    className?: string
}) {
    if (!clan) return null
    return (
        <span
            title={clan.name}
            role="img"
            aria-label={clan.name}
            className={cn("inline-flex shrink-0", className)}
        >
            <Avatar className="bg-background border-background size-3.5 border">
                <AvatarImage src={clan.avatar} alt="" />
                <AvatarFallback className="text-foreground text-[7px] font-semibold">
                    {clan.name.slice(0, 2)}
                </AvatarFallback>
            </Avatar>
        </span>
    )
}
