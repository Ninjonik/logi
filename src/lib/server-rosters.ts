import { fetchMutation } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";

const deleteDraftRosterReference = makeFunctionReference<"mutation">("rosters:deleteDraft");

export async function deleteDraftRoster(rosterId: string) {
  return await fetchMutation(deleteDraftRosterReference, {
    secret: getInternalAuthSecret(),
    rosterId: rosterId as never,
  });
}
