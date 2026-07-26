"use client";

export async function uploadFileToConvex(file: File, messages?: {
  prepareUploadError?: string;
  uploadFileError?: string;
  readFileUrlError?: string;
}) {
  const uploadResponse = await fetch("/api/uploads", { method: "POST" });
  const uploadBody = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(uploadBody.error ?? messages?.prepareUploadError ?? "Unable to prepare the upload.");
  }

  const storageResponse = await fetch(uploadBody.uploadUrl, {
    method: "POST",
    headers: {
      "content-type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!storageResponse.ok) {
    throw new Error(messages?.uploadFileError ?? "Unable to upload the file.");
  }

  const { storageId } = await storageResponse.json();

  const urlResponse = await fetch("/api/uploads/url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storageId, filename: file.name }),
  });
  const urlBody = await urlResponse.json();
  if (!urlResponse.ok) {
    throw new Error(urlBody.error ?? messages?.readFileUrlError ?? "Unable to read the uploaded file URL.");
  }

  return {
    storageId: storageId as string,
    url: urlBody.url as string,
  };
}
