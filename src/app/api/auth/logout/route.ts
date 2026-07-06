import { NextRequest, NextResponse } from "next/server";

import { clearSessionToken } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";

function sanitizeRedirect(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/en/login";
  }
  return value;
}

export async function GET(request: NextRequest) {
  await clearSessionToken();
  const redirectTo = sanitizeRedirect(request.nextUrl.searchParams.get("redirectTo"));
  return NextResponse.redirect(new URL(redirectTo, getSiteUrl()));
}
