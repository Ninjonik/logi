import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createSessionToken, setSessionToken, syncCurrentPlayerFromDiscord, syncManagedGuildsForCurrentPlayer } from "@/lib/auth";
import {
  exchangeDiscordCode,
  fetchDiscordGuilds,
  fetchDiscordUser,
  getDiscordAvatarUrl,
  getDiscordGuildIconUrl,
  isBotInsideDiscordGuild,
  isDiscordGuildAdmin,
} from "@/lib/discord";
import { getSiteUrl } from "@/lib/env";

const STATE_COOKIE = "discord_oauth_state";
const REDIRECT_COOKIE = "discord_oauth_redirect";

function cleanOauthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(REDIRECT_COOKIE);
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const redirectTo = cookieStore.get(REDIRECT_COOKIE)?.value ?? "/en/dashboard";

  if (!code || !state || !expectedState || state !== expectedState) {
    cleanOauthCookies(cookieStore);
    return NextResponse.redirect(new URL("/en/login?error=oauth-state", getSiteUrl()));
  }

  try {
    const tokenResponse = await exchangeDiscordCode(code);
    const discordUser = await fetchDiscordUser(tokenResponse.access_token);
    const discordGuilds = await fetchDiscordGuilds(tokenResponse.access_token);
    const userId = discordUser.id;
    const session = {
      sub: userId,
      name: discordUser.username,
      avatar: getDiscordAvatarUrl(discordUser),
    };

    await syncCurrentPlayerFromDiscord(session);
    const managedGuilds = await Promise.all(
      discordGuilds
        .filter(isDiscordGuildAdmin)
        .map(async (guild) => ({
          id: guild.id,
          name: guild.name,
          avatar: getDiscordGuildIconUrl(guild),
          botInside: await isBotInsideDiscordGuild(guild.id),
        })),
    );
    await syncManagedGuildsForCurrentPlayer(userId, managedGuilds);
    const sessionToken = await createSessionToken(session);
    await setSessionToken(sessionToken);
    cleanOauthCookies(cookieStore);

    return NextResponse.redirect(new URL(redirectTo, getSiteUrl()));
  } catch (e) {
    console.error("Failed to exchange Discord code:", e);
    cleanOauthCookies(cookieStore);
    return NextResponse.redirect(new URL("/en/login?error=discord-login", getSiteUrl()));
  }
}
