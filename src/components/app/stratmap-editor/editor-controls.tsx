"use client";

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export const editorFieldClass = "h-7 w-full min-w-0 rounded-[3px] border border-border/70 bg-background/80 px-1.5 text-[11px] leading-none text-foreground shadow-inner shadow-black/5 outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-border focus:border-primary/70 focus:ring-1 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-45";

export function EditorPanel({ title, icon: Icon, action, children, className }: { title: string; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 overflow-hidden rounded-[5px] border border-border/70 bg-card/55", className)}>
      <header className="flex h-7 items-center gap-1.5 border-b border-border/60 bg-muted/30 px-2">
        {Icon ? <Icon className="size-3 text-muted-foreground" /> : null}
        <h2 className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/80">{title}</h2>
        {action}
      </header>
      <div className="space-y-1.5 p-2">{children}</div>
    </section>
  );
}

export function EditorField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block min-w-0 space-y-0.5", className)}>
      <span className="block truncate text-[9px] font-medium uppercase tracking-[0.07em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export const EditorInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function EditorInput({ className, ...props }, ref) {
  return <input ref={ref} className={cn(editorFieldClass, className)} {...props} />;
});

export const EditorTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function EditorTextarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(editorFieldClass, "h-auto min-h-12 resize-y py-1 leading-4", className)} {...props} />;
});

export const EditorSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function EditorSelect({ className, children, ...props }, ref) {
  return <select ref={ref} className={cn(editorFieldClass, "appearance-auto pr-1", className)} {...props}>{children}</select>;
});

export function EditorButton({ className, active, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button className={cn("inline-flex h-7 items-center justify-center gap-1 rounded-[3px] border border-border/70 bg-background/70 px-2 text-[10px] font-medium text-foreground/85 outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-primary/60 disabled:pointer-events-none disabled:opacity-35", active && "border-primary/70 bg-primary/15 text-primary", className)} {...props} />;
}

export function EditorIconButton({ icon: Icon, label, className, active, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <EditorButton type="button" className={cn("size-6 shrink-0 px-0", className)} active={active} title={label} aria-label={label} {...props}>
      <Icon className="size-3.5" />
    </EditorButton>
  );
}

export function EditorToggle({ label, checked, onCheckedChange, disabled }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-2 border-t border-border/40 py-1 first:border-t-0">
      <span className="text-[10px] text-foreground/80">{label}</span>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onCheckedChange(!checked)} className={cn("relative h-3.5 w-6 shrink-0 rounded-full border border-border bg-muted outline-none transition-colors focus-visible:ring-1 focus-visible:ring-primary/60 disabled:opacity-40", checked && "border-primary/70 bg-primary/80")}>
        <span className={cn("absolute top-[2px] left-[2px] size-2 rounded-full bg-background shadow-sm transition-transform", checked && "translate-x-2.5")} />
      </button>
    </div>
  );
}
