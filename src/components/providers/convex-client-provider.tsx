"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useEffect, useState } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);

  useEffect(() => {
    setClient(new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!));
  }, []);

  if (!client) {
    return null;
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
