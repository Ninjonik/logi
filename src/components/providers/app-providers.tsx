import { ReactNode } from "react";

import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { UserContextProvider } from "@/contexts/user-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      <UserContextProvider initialUser={null}>{children}</UserContextProvider>
    </ConvexClientProvider>
  );
}
