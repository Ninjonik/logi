import { ArrowRight, Bot, ShieldCheck, Users } from "lucide-react"
import Link from "next/link"

import { RefreshBotStatusButton } from "@/components/app/refresh-bot-status-button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BotInviteButton } from "@/components/app/bot-invite-button"
import { buildDiscordBotInviteUrl } from "@/lib/discord"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Guild } from "@/types/domain"
import type { Locale } from "@/i18n/config"

export function ServerCard({
    locale,
    guild,
    label,
    dictionary,
    inviteRoleHierarchyRelevant = false,
}: {
    locale: Locale
    guild: Guild
    label: string
    dictionary: Dictionary
    inviteRoleHierarchyRelevant?: boolean
}) {
    return (
        <Card className="border-border/60 bg-card/80 overflow-hidden rounded-2xl pt-0 shadow-sm">
            <CardHeader className="border-border/60 relative overflow-hidden border-b bg-[linear-gradient(135deg,rgba(90,110,55,.2),rgba(201,168,78,.08))] pt-4">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,168,78,.22),transparent_40%)]" />
                <div className="relative flex h-24 items-start gap-4">
                    <Avatar className="border-border/60 size-16 rounded-2xl border">
                        <AvatarImage src={guild.avatar} alt={guild.name} />
                        <AvatarFallback>
                            {guild.name.slice(0, 2)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <Badge
                            variant="secondary"
                            className="mb-3 rounded-full"
                        >
                            {label}
                        </Badge>
                        <h2 className="truncate text-xl font-semibold">
                            {guild.name}
                        </h2>
                        <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                            {guild.description}
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid gap-4 py-5 sm:grid-cols-3">
                <div className="border-border/60 rounded-xl border p-3">
                    <div className="text-muted-foreground flex items-center gap-2 text-xs tracking-[0.2em] uppercase">
                        <ShieldCheck className="size-3.5" />
                        {dictionary.common.admins}
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                        {guild.adminIds.length}
                    </div>
                </div>
                <div className="border-border/60 rounded-xl border p-3">
                    <div className="text-muted-foreground flex items-center gap-2 text-xs tracking-[0.2em] uppercase">
                        <Users className="size-3.5" />
                        {dictionary.clan.members}
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                        {guild.memberIds.length}
                    </div>
                </div>
                <div className="border-border/60 rounded-xl border p-3">
                    <div className="text-muted-foreground flex items-center gap-2 text-xs tracking-[0.2em] uppercase">
                        <Bot className="size-3.5" />
                        {dictionary.dashboard.botStatus}
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                        {guild.botInside
                            ? dictionary.dashboard.botInstalled
                            : dictionary.dashboard.botMissing}
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                {guild.botInside ? (
                    <Button asChild className="w-full rounded-xl">
                        <Link
                            href={`/${locale}/dashboard/servers/${guild.id}`}
                            prefetch={false}
                        >
                            {dictionary.dashboard.openServer}
                            <ArrowRight className="size-4" />
                        </Link>
                    </Button>
                ) : (
                    <div className="flex w-full gap-2">
                        <BotInviteButton
                            dictionary={dictionary}
                            inviteUrl={buildDiscordBotInviteUrl(
                                guild.discordId
                            )}
                            roleHierarchyRelevant={inviteRoleHierarchyRelevant}
                            className="flex-1 rounded-xl"
                        >
                            <>
                                {dictionary.dashboard.inviteBot}
                                <ArrowRight className="size-4" />
                            </>
                        </BotInviteButton>
                        <RefreshBotStatusButton dictionary={dictionary} />
                    </div>
                )}
            </CardFooter>
        </Card>
    )
}
