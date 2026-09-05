import { NextResponse } from "next/server";
import { isCurrentUserSuperadmin } from "@/lib/auth";
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { mergeCompetitionGuilds } from "@/lib/read-models/competitions";
export async function POST(request: Request) { if (!(await isCurrentUserSuperadmin())) return NextResponse.json({ error: "Forbidden." }, { status: 403 }); const body = await request.json(); if (!body.primaryGuildId || !body.secondaryGuildId || body.primaryGuildId === body.secondaryGuildId) return NextResponse.json({ error: "Pick a primary and a different source clan." }, { status: 400 }); try { await mergeCompetitionGuilds(body.primaryGuildId, body.secondaryGuildId); revalidateCacheEntries([appCacheTags.competition("ecl-2026"), appCacheTags.publicDiscovery()]); return NextResponse.json({ ok: true }); } catch { return NextResponse.json({ error: "Unable to merge clans." }, { status: 500 }); } }
