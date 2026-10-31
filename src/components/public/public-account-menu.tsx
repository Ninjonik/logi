"use client"

import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getLeagueMessages } from "@/i18n/messages/leagues"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import type { Locale } from "@/i18n/config"
import Link from "next/link"

export function PublicAccountMenu({
    user,
    locale,
}: {
    user: { name: string; avatar: string | null } | null
    locale: Locale
}) {
    const t = getLeagueMessages(locale)
    const router = useRouter()
    if (!user)
        return (
            <Button
                variant="outline"
                size="sm"
                onClick={() => {
                    const current =
                        window.location.pathname + window.location.search
                    const destination =
                        window.location.pathname === `/${locale}/login`
                            ? `/${locale}`
                            : current
                    router.push(
                        `/${locale}/login?redirectTo=${encodeURIComponent(destination)}`
                    )
                }}
            >
                {t.login}
            </Button>
        )
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="max-w-40 gap-2 px-2"
                    aria-label={user.name}
                >
                    <Avatar className="size-7">
                        <AvatarImage src={user.avatar ?? undefined} alt="" />
                        <AvatarFallback>
                            {user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <span className="hidden truncate lg:inline">
                        {user.name}
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                    <Link href={`/${locale}/league-teams`}>{t.manage}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form
                    action={`/api/auth/logout?redirectTo=${encodeURIComponent(`/${locale}`)}`}
                    method="post"
                >
                    <DropdownMenuItem
                        asChild
                        onSelect={(event) => event.preventDefault()}
                    >
                        <button type="submit" className="w-full">
                            {t.logout}
                        </button>
                    </DropdownMenuItem>
                </form>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
