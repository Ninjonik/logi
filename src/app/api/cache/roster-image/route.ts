import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { getInternalAuthSecret } from "@/lib/env";
import { getLoggedInUser } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { eventId?: string; secret?: string } | null;

  const user = await getLoggedInUser();
  const authorized = Boolean(user) || body?.secret === getInternalAuthSecret();

  if (!body?.eventId || !authorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  revalidateTag(`roster-image:${body.eventId}`, "max");
  return NextResponse.json({ ok: true });
}
