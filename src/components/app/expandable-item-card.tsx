"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function ExpandableItemCard({
  open,
  onOpenChange,
  title,
  subtitle,
  actions,
  children,
  className,
  headerClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className={cn("rounded-2xl border border-border/60", className)}>
      <div className={cn("flex items-center justify-between gap-4 p-4", headerClassName)}>
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-xl"
            onClick={() => onOpenChange(!open)}
            aria-label={open ? "Collapse item" : "Expand item"}
          >
            <ChevronDown className={cn("size-4 transition-transform", open ? "rotate-0" : "-rotate-90")} />
          </Button>
          <div className="min-w-0">
            <div className="truncate font-medium">{title}</div>
            {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <CollapsibleContent className="space-y-4 px-4 pb-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
