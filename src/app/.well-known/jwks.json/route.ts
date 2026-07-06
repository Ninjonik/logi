import { NextResponse } from "next/server";

import { getAuthJwksJson } from "@/lib/env";

export async function GET() {
  return NextResponse.json(JSON.parse(getAuthJwksJson()), {
    headers: {
      "cache-control": "public, max-age=300",
    },
  });
}
