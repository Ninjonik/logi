import { NextResponse } from "next/server";

import { getCurrentPlayer } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";

export async function GET() {
  const player = await getCurrentPlayer();
  if (!player) {
    return NextResponse.redirect(new URL("/en/login", getSiteUrl()));
  }

  const siteUrl = getSiteUrl();
  const callbackUrl = new URL("/api/steam/callback", siteUrl);
  const steamUrl = new URL("https://steamcommunity.com/openid/login");

  steamUrl.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
  steamUrl.searchParams.set("openid.mode", "checkid_setup");
  steamUrl.searchParams.set("openid.return_to", callbackUrl.toString());
  steamUrl.searchParams.set("openid.realm", siteUrl);
  steamUrl.searchParams.set(
    "openid.identity",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );
  steamUrl.searchParams.set(
    "openid.claimed_id",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );

  return NextResponse.redirect(steamUrl);
}
