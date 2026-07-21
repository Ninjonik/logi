import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { buildDiscordAuthorizationUrl } from "@/lib/discord";

const STATE_COOKIE = "discord_oauth_state";
const REDIRECT_COOKIE = "discord_oauth_redirect";
const GUILD_COOKIE = "discord_oauth_guild";

function sanitizeRedirect(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/en/dashboard";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const redirectTo = sanitizeRedirect(request.nextUrl.searchParams.get("redirectTo"));
  const guildId = request.nextUrl.searchParams.get("guildId");
  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();

  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  cookieStore.set(REDIRECT_COOKIE, redirectTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  if (guildId && /^\d{5,32}$/.test(guildId)) {
    cookieStore.set(GUILD_COOKIE, guildId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
  } else {
    cookieStore.delete(GUILD_COOKIE);
  }

  return NextResponse.redirect(buildDiscordAuthorizationUrl(state));
}
