"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = { initialQuery: string; label: string; placeholder: string };

/** Keeps the public player finder immediate without issuing a request for every keystroke. */
export function PublicPlayerSearch({ initialQuery, label, placeholder }: Props) {
  const [value, setValue] = useState(initialQuery);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === initialQuery) return;
    const timeout = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("playersCursor");
      if (trimmed.length >= 2) next.set("q", trimmed);
      else next.delete("q");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [initialQuery, pathname, router, searchParams, value]);

  return <div className="mt-4"><label className="sr-only" htmlFor="player-search">{label}</label><input id="player-search" value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-md border bg-background px-3 text-sm" autoComplete="off" /></div>;
}
