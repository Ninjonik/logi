import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getConvexFileUrl } from "@/lib/server-uploads";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";

const schema = z.object({
  storageId: z.string().min(1),
  filename: z.string().trim().min(1).optional(),
});

function sanitizeFilename(filename?: string) {
  if (!filename) return "attachment.bin";

  const sanitized = filename
    .split(/[\\/]/)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "");

  return sanitized || "attachment.bin";
}

export async function POST(request: NextRequest) {
  try {
    const { storageId, filename } = schema.parse(await request.json());
    const url = await getConvexFileUrl(storageId);
    if (!url) {
      throw new Error("File URL is not available.");
    }

    return NextResponse.json({
      url: `${request.nextUrl.origin}/api/uploads/file/${encodeURIComponent(storageId)}/${encodeURIComponent(sanitizeFilename(filename))}`,
    });
  } catch (error) {
    logRouteError("uploads.url", error);
    return NextResponse.json(
      { error: getUserSafeErrorMessage(error, "Unable to read the uploaded file URL.") },
      { status: 400 },
    );
  }
}
