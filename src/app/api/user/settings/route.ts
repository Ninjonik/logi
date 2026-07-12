import { NextResponse } from "next/server";

import { handleIfNotLoggedIn, updateCurrentPlayerProfile } from "@/lib/auth";

export async function POST(request: Request) {
  await handleIfNotLoggedIn("/dashboard/settings/user");

  try {
    const body = (await request.json()) as {
      avatar?: string;
    };

    if (!body.avatar?.trim()) {
      return NextResponse.json({ error: "Avatar is required." }, { status: 400 });
    }

    await updateCurrentPlayerProfile({
      avatar: body.avatar,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save user settings", error);
    return NextResponse.json({ error: "Unable to save user settings." }, { status: 500 });
  }
}
