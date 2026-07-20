"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfigNotice({
  tone = "warning",
  title,
  children,
  href,
  ctaLabel,
  className,
}: {
  tone?: "warning" | "info";
  title: string;
  children: ReactNode;
  href?: string;
  ctaLabel?: string;
  className?: string;
}) {
  const Icon = tone === "warning" ? AlertTriangle : Info;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "warning"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-sky-500/30 bg-sky-500/10 text-sky-950 dark:text-sky-100",
        className,
      )}
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 space-y-2">
          <div className="font-semibold">{title}</div>
          <div className="text-sm opacity-90">{children}</div>
          {href && ctaLabel ? (
            <Button asChild size="sm" variant="outline" className="rounded-xl bg-transparent">
              <Link href={href}>{ctaLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
