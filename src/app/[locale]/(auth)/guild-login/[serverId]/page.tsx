import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import type { Metadata } from "next"
import Link from "next/link"

import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { DiscordSignInButton } from "@/components/auth/discord-sign-in-button"
import { getCurrentPlayer, getVisibleGuildsForLoggedInUser } from "@/lib/auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getGuildMetadataByDiscordId } from "@/lib/server-metadata"
import { Card, CardContent } from "@/components/ui/card"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import type { Guild } from "@/types/domain"
import { isLocale } from "@/i18n/config"

type GuildLoginPageProps = {
    params: Promise<{
        locale: string
        serverId: string
    }>
}

export const metadata: Metadata = {
    title: "Sign in",
    description: "Sign in to continue to Logi.",
    robots: { index: false, follow: false },
}

export function generateStaticParams() {
    return [{ locale: "en", serverId: "sample-server" }]
}

export default async function GuildLoginPage({ params }: GuildLoginPageProps) {
    await connection()

    const { locale, serverId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const guild = (await getGuildMetadataByDiscordId(serverId)) as Guild | null

    if (!guild) {
        notFound()
    }

    const redirectTo = `/${safeLocale}/dashboard/servers/${guild.id}`
    const user = await getCurrentPlayer()

    if (user) {
        const visibleGuilds = await getVisibleGuildsForLoggedInUser()
        const canOpenGuild = visibleGuilds.some(
            (visibleGuild) => visibleGuild.id === guild.id
        )

        if (canOpenGuild) {
            redirect(redirectTo)
        }
    }
    // Signed in but not a member: offering the same sign-in button again
    // would only loop back here, so explain and name the next step.
    const notMember = Boolean(user)
    const t = dictionary.publicSite.guildLogin

    return (
        <PublicSiteShell locale={safeLocale}>
            <PublicPage className="flex max-w-sm items-center">
                <Card className="border-border/60 bg-card text-card-foreground w-full max-w-sm rounded-2xl shadow-2xl shadow-black/10">
                    <CardContent className="flex flex-col items-center gap-7 p-8 text-center">
                        <Avatar className="bg-muted size-28 rounded-2xl border">
                            <AvatarImage
                                src={guild.avatar}
                                alt={guild.name}
                                className="object-cover"
                            />
                            <AvatarFallback className="bg-muted text-muted-foreground rounded-2xl text-3xl">
                                {guild.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>

                        <div className="w-full space-y-3">
                            <h1 className="text-2xl font-semibold">
                                {guild.name}
                            </h1>
                            {notMember && user ? (
                                <div
                                    role="status"
                                    className="space-y-2 text-left text-sm"
                                >
                                    <p className="font-medium">
                                        {t.notMemberTitle.replace(
                                            "{clan}",
                                            guild.name
                                        )}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {t.notMemberDescription.replace(
                                            "{name}",
                                            user.name
                                        )}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {t.notMemberNextStep}
                                    </p>
                                </div>
                            ) : null}
                            <DiscordSignInButton
                                redirectTo={redirectTo}
                                label={
                                    notMember
                                        ? t.signInAgain
                                        : dictionary.auth.loginButton
                                }
                                guildId={guild.discordId}
                            />
                            {notMember ? (
                                <Button
                                    asChild
                                    variant="outline"
                                    className="h-11 w-full rounded-xl"
                                >
                                    <Link href={`/${safeLocale}/dashboard`}>
                                        {t.openDashboard}
                                    </Link>
                                </Button>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>
            </PublicPage>
        </PublicSiteShell>
    )
}
