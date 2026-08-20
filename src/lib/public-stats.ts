import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { unstable_cache } from "next/cache";

const getPublicOverviewStatsReference = makeFunctionReference<"query">("publicStats:overview");

export const getPublicOverviewStats = unstable_cache(
  async () => {
    return await fetchQuery(getPublicOverviewStatsReference, {});
  },
  ["public-overview-stats"],
  {
    revalidate: 300,
  },
);
