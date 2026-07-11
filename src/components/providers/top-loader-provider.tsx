"use client";

import NextTopLoader from "nextjs-toploader";

export function TopLoaderProvider() {
  return (
    <NextTopLoader
      color="var(--top-loader)"
      height={3}
      showSpinner={false}
      crawlSpeed={160}
      easing="ease"
      speed={220}
      shadow="0 0 10px var(--top-loader-glow), 0 0 5px var(--top-loader-glow)"
      zIndex={9999}
    />
  );
}
