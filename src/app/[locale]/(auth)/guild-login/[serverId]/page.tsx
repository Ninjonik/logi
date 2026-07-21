import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { DiscordSignInButton } from "@/components/auth/discord-sign-in-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getCurrentPlayer, getVisibleGuildsForLoggedInUser } from "@/lib/auth";
import { getGuildMetadataByDiscordId } from "@/lib/server-metadata";
import type { Guild } from "@/types/domain";

type GuildLoginPageProps = {
  params: Promise<{
    locale: string;
    serverId: string;
  }>;
};

export async function generateMetadata({ params }: GuildLoginPageProps): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);

  return {
    title: dictionary.auth.loginTitle,
    description: dictionary.auth.loginDescription,
    openGraph: {
      title: dictionary.auth.loginTitle,
      description: dictionary.auth.loginDescription,
    },
  };
}

export default async function GuildLoginPage({ params }: GuildLoginPageProps) {
  await connection();

  const { locale, serverId } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const guild = (await getGuildMetadataByDiscordId(serverId)) as Guild | null;

  if (!guild) {
    notFound();
  }

  const redirectTo = `/${safeLocale}/dashboard/servers/${guild.id}`;
  const user = await getCurrentPlayer();

  if (user) {
    const visibleGuilds = await getVisibleGuildsForLoggedInUser();
    const canOpenGuild = visibleGuilds.some((visibleGuild) => visibleGuild.id === guild.id);

    if (canOpenGuild) {
      redirect(redirectTo);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#101826,#0a0f18)] px-6 py-12 text-white">
      <Card className="w-full max-w-sm rounded-2xl border-white/10 bg-white/6 text-white shadow-2xl shadow-black/30 backdrop-blur-xl">
        <CardContent className="flex flex-col items-center gap-7 p-8 text-center">
          <Avatar className="size-28 rounded-2xl border border-white/10 bg-black/20">
            <AvatarImage src={guild.avatar} alt={guild.name} className="object-cover" />
            <AvatarFallback className="rounded-2xl bg-black/30 text-3xl text-white">
              {guild.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="w-full space-y-3">
            <h1 className="text-2xl font-semibold">{guild.name}</h1>
            <DiscordSignInButton redirectTo={redirectTo} label={dictionary.auth.loginButton} guildId={guild.discordId} />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
