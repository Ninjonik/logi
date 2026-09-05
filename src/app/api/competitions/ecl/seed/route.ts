import { NextResponse } from "next/server";
import { isCurrentUserSuperadmin } from "@/lib/auth";
import { revalidateCacheEntries, appCacheTags } from "@/lib/cache-tags";
import { seedEclCompetition } from "@/lib/read-models/competitions";

export async function POST() {
  if (!(await isCurrentUserSuperadmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  await seedEclCompetition(); revalidateCacheEntries([appCacheTags.competition("ecl-2026"), appCacheTags.publicDiscovery()]);
  return NextResponse.json({ ok: true });
}
