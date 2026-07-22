import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { NextRequest, NextResponse } from "next/server";

import { getInternalAuthSecret } from "@/lib/env";
import { parsePlatformIdsInput } from "@/lib/platform-ids";

const getPlatformIdLinkTokenReference = makeFunctionReference<"query">("platformIdLinks:getPlatformIdLinkToken");
const consumePlatformIdLinkTokenReference = makeFunctionReference<"mutation">("platformIdLinks:consumePlatformIdLinkToken");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenRecord = await fetchQuery(getPlatformIdLinkTokenReference, { token });

  if (!tokenRecord) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  return NextResponse.json(tokenRecord);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json() as { platformId?: string };
  const platformIds = parsePlatformIdsInput(body.platformId);

  if (!platformIds.length) {
    return NextResponse.json({ error: "Enter a valid platform ID." }, { status: 400 });
  }

  try {
    await fetchMutation(consumePlatformIdLinkTokenReference, {
      secret: getInternalAuthSecret(),
      token,
      platformId: platformIds[0],
    });

    return NextResponse.json({
      ok: true,
      message: "Platform ID saved. You can close this page now and return to Discord.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save platform ID.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
