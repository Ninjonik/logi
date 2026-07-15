import { NextResponse } from "next/server";

import { handleIfNotLoggedIn, updateCurrentPlayerProfile } from "@/lib/auth";

export async function POST(request: Request) {
  await handleIfNotLoggedIn("/dashboard/settings/user");

  try {
    const body = (await request.json()) as {
      avatar?: string;
      platformIds?: string;
    };

    if (!body.avatar?.trim()) {
      return NextResponse.json({ error: "Avatar is required." }, { status: 400 });
    }

    await updateCurrentPlayerProfile({
      avatar: body.avatar,
      platformIds: body.platformIds,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save user settings", error);
    const message = error instanceof Error && error.message.includes("already linked to another player")
      ? "One of these platform IDs is already linked to another player."
      : "Unable to save user settings.";
    return NextResponse.json({ error: message }, { status: message === "Unable to save user settings." ? 500 : 400 });
  }
}
