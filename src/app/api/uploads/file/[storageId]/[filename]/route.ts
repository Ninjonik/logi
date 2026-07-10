import { NextResponse } from "next/server";

import { getConvexFileUrl } from "@/lib/server-uploads";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storageId: string; filename: string }> },
) {
  try {
    const { storageId } = await params;
    const url = await getConvexFileUrl(storageId);
    if (!url) {
      throw new Error("File URL is not available.");
    }

    return NextResponse.redirect(url, 307);
  } catch (error) {
    logRouteError("uploads.file", error);
    return NextResponse.json(
      { error: getUserSafeErrorMessage(error, "Unable to read the uploaded file.") },
      { status: 404 },
    );
  }
}
