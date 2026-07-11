import { NextResponse } from "next/server";

import { getConvexFileUrl } from "@/lib/server-uploads";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storageId: string; filename: string }> },
) {
  try {
    const { storageId, filename } = await params;
    const url = await getConvexFileUrl(storageId);
    if (!url) {
      throw new Error("File URL is not available.");
    }

    const range = request.headers.get("range");
    const fileResponse = await fetch(url, {
      headers: range ? { range } : undefined,
    });
    if (!fileResponse.ok || !fileResponse.body) {
      throw new Error("File is not available.");
    }

    const headers = new Headers();
    const contentType = fileResponse.headers.get("content-type");
    const contentLength = fileResponse.headers.get("content-length");
    const cacheControl = fileResponse.headers.get("cache-control");
    const etag = fileResponse.headers.get("etag");
    const lastModified = fileResponse.headers.get("last-modified");
    const acceptRanges = fileResponse.headers.get("accept-ranges");
    const contentRange = fileResponse.headers.get("content-range");

    if (contentType) headers.set("content-type", contentType);
    if (contentLength) headers.set("content-length", contentLength);
    if (cacheControl) headers.set("cache-control", cacheControl);
    if (etag) headers.set("etag", etag);
    if (lastModified) headers.set("last-modified", lastModified);
    if (acceptRanges) headers.set("accept-ranges", acceptRanges);
    if (contentRange) headers.set("content-range", contentRange);
    headers.set("content-disposition", `inline; filename="${filename.replace(/["\\]/g, "")}"`);

    return new Response(fileResponse.body, {
      status: fileResponse.status,
      headers,
    });
  } catch (error) {
    logRouteError("uploads.file", error);
    return NextResponse.json(
      { error: getUserSafeErrorMessage(error, "Unable to read the uploaded file.") },
      { status: 404 },
    );
  }
}
