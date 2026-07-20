import { NextResponse } from "next/server";

import { getInternalAuthSecret } from "@/lib/env";
import { getLoggedInUser } from "@/lib/auth";
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { eventId?: string; secret?: string } | null;

  const user = await getLoggedInUser();
  const authorized = Boolean(user) || body?.secret === getInternalAuthSecret();

  if (!body?.eventId || !authorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  revalidateCacheEntries([
    appCacheTags.rosterImage(),
    appCacheTags.rosterImageEvent(body.eventId),
  ]);
  return NextResponse.json({ ok: true });
}
