import { NextResponse } from "next/server";

import { getServerContext } from "@/lib/server-context";
import { createClanApiKey, listClanApiKeys, revokeClanApiKey } from "@/lib/public-api";

export async function GET(_request: Request, { params }: { params: Promise<{ serverId: string }> }) {
  const { serverId } = await params;
  const context = await getServerContext(serverId);
  if (!context?.canAdmin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  return NextResponse.json({ keys: await listClanApiKeys(serverId) });
}

export async function POST(request: Request, { params }: { params: Promise<{ serverId: string }> }) {
  const { serverId } = await params;
  const context = await getServerContext(serverId);
  if (!context?.canAdmin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const body = await request.json().catch(() => null) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) return NextResponse.json({ error: "Enter a key name of up to 80 characters." }, { status: 400 });
  const key = await createClanApiKey(serverId, name);
  return NextResponse.json({ key }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ serverId: string }> }) {
  const { serverId } = await params;
  const context = await getServerContext(serverId);
  if (!context?.canAdmin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const keyId = new URL(request.url).searchParams.get("keyId");
  if (!keyId) return NextResponse.json({ error: "Missing keyId." }, { status: 400 });
  await revokeClanApiKey(serverId, keyId);
  return NextResponse.json({ ok: true });
}
