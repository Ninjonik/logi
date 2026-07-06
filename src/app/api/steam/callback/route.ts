import { NextRequest, NextResponse } from "next/server";

import { linkSteamForCurrentPlayer } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";

function getLocaleAwareSettingsUrl() {
  return new URL("/en/dashboard/settings/user", getSiteUrl());
}

function extractSteamId(claimedId: string | null) {
  if (!claimedId) return null;
  const match = claimedId.match(
    /^https:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/,
  );
  return match?.[1] ?? null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const claimedId = searchParams.get("openid.claimed_id");
  const steamId = extractSteamId(claimedId);

  if (!steamId) {
    return NextResponse.redirect(
      new URL("/en/dashboard/settings/user?steam=missing-id", getSiteUrl()),
    );
  }

  const verification = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    verification.set(key, value);
  }
  verification.set("openid.mode", "check_authentication");

  const response = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: verification.toString(),
  });

  const body = await response.text();
  if (!body.includes("is_valid:true")) {
    return NextResponse.redirect(
      new URL("/en/dashboard/settings/user?steam=invalid", getSiteUrl()),
    );
  }

  try {
    await linkSteamForCurrentPlayer(steamId);
  } catch {
    return NextResponse.redirect(
      new URL("/en/dashboard/settings/user?steam=link-failed", getSiteUrl()),
    );
  }

  const redirectUrl = getLocaleAwareSettingsUrl();
  redirectUrl.searchParams.set("steam", "linked");
  return NextResponse.redirect(redirectUrl);
}
