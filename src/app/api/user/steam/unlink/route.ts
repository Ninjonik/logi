import { NextResponse } from "next/server";

import { handleIfNotLoggedIn, unlinkSteamForCurrentPlayer } from "@/lib/auth";

export async function POST() {
  await handleIfNotLoggedIn("/dashboard/settings/user");

  try {
    await unlinkSteamForCurrentPlayer();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to unlink Steam", error);
    return NextResponse.json({ error: "Unable to unlink Steam." }, { status: 500 });
  }
}
