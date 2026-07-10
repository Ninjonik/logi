import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getConvexFileUrl } from "@/lib/server-uploads";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";

const schema = z.object({
  storageId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { storageId } = schema.parse(await request.json());
    const url = await getConvexFileUrl(storageId);
    if (!url) {
      throw new Error("File URL is not available.");
    }

    return NextResponse.json({ url });
  } catch (error) {
    logRouteError("uploads.url", error);
    return NextResponse.json(
      { error: getUserSafeErrorMessage(error, "Unable to read the uploaded file URL.") },
      { status: 400 },
    );
  }
}
