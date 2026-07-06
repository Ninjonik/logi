import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { buildDiscordAuthorizationUrl } from "@/lib/discord";

const STATE_COOKIE = "discord_oauth_state";
const REDIRECT_COOKIE = "discord_oauth_redirect";

function sanitizeRedirect(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/en/dashboard";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const redirectTo = sanitizeRedirect(request.nextUrl.searchParams.get("redirectTo"));
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

  return NextResponse.redirect(buildDiscordAuthorizationUrl(state));
}
