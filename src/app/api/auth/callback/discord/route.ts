import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { createSessionToken, setSessionToken, syncCurrentPlayerFromDiscord } from "@/lib/auth";
import { exchangeDiscordCode, fetchDiscordUser, getDiscordAvatarUrl } from "@/lib/discord";
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
    const session = {
      sub: discordUser.id,
      name: discordUser.username,
      avatar: getDiscordAvatarUrl(discordUser),
    };

    const sessionToken = await createSessionToken(session);
    await setSessionToken(sessionToken);
    await syncCurrentPlayerFromDiscord(session, sessionToken);
    cleanOauthCookies(cookieStore);

    return NextResponse.redirect(new URL(redirectTo, getSiteUrl()));
  } catch (e) {
    console.error("Failed to exchange Discord code:", e);
    cleanOauthCookies(cookieStore);
    return NextResponse.redirect(new URL("/en/login?error=discord-login", getSiteUrl()));
  }
}
