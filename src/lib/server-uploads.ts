import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";

const generateUploadUrlReference = makeFunctionReference<"mutation">("uploads:generateUploadUrl");
const getUrlReference = makeFunctionReference<"query">("uploads:getUrl");

export async function generateConvexUploadUrl() {
  return await fetchMutation(generateUploadUrlReference, {
    secret: getInternalAuthSecret(),
  });
}

export async function getConvexFileUrl(storageId: string) {
  return await fetchQuery(getUrlReference, {
    storageId: storageId as never,
  });
}
