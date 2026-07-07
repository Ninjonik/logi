import { ReactNode } from "react";

import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { UserContextProvider } from "@/contexts/user-context";
import { getLoggedInUser } from "@/lib/auth";

export async function AppProviders({ children }: { children: ReactNode }) {
  const user = await getLoggedInUser();

  return (
    <ConvexClientProvider>
      <UserContextProvider initialUser={user}>{children}</UserContextProvider>
    </ConvexClientProvider>
  );
}
