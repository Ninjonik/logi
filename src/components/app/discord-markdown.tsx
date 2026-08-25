"use client";

import dynamic from "next/dynamic";
import { commands as markdownCommands, type MDEditorProps } from "@uiw/react-md-editor";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

import { useTheme } from "@/hooks/use-theme";
import { formatDiscordMarkdown } from "@/lib/discord-markdown";
import { cn } from "@/lib/utils";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

const compactMarkdownCommands: NonNullable<MDEditorProps["commands"]> = [
  markdownCommands.bold,
  markdownCommands.italic,
  markdownCommands.unorderedListCommand,
  markdownCommands.orderedListCommand,
  markdownCommands.link,
];

const compactMarkdownExtraCommands: NonNullable<MDEditorProps["extraCommands"]> = [
  markdownCommands.fullscreen,
];

const discordMarkdownClassName = cn(
  "discord-markdown text-sm leading-6 break-words",
  "[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2",
  "[&_blockquote]:border-l-4 [&_blockquote]:border-white/20 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_code]:rounded-[4px] [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em] dark:[&_code]:bg-white/10",
  "[&_em]:italic [&_hr]:my-3 [&_hr]:border-white/15",
  "[&_li]:ml-5 [&_li]:list-disc [&_li]:whitespace-break-spaces [&_ol]:space-y-1 [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/10 [&_pre]:p-3 dark:[&_pre]:bg-white/10",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_strong]:font-semibold [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-white/10 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:space-y-1 [&_ul]:pl-5",
  "[&_p]:whitespace-break-spaces [&_p:not(:last-child)]:mb-1.5",
);

export function DiscordMarkdownText({
  markdown,
  className,
  emptyLabel,
}: {
  markdown?: string | null;
  className?: string;
  emptyLabel?: string;
}) {
  const value = useMemo(() => formatDiscordMarkdown(markdown), [markdown]);

  if (!value) {
    return emptyLabel ? <div className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</div> : null;
  }

  return (
    <div className={cn(discordMarkdownClassName, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {value}
      </ReactMarkdown>
    </div>
  );
}

type EditorProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  rows?: number;
  className?: string;
  height?: number;
  hideToolbar?: boolean;
  compactToolbar?: boolean;
  preview?: "live" | "edit" | "preview";
};

export function DiscordMarkdownTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  maxLength,
  rows,
  className,
  height,
  hideToolbar = false,
  compactToolbar = false,
  preview = "live",
}: EditorProps) {
  const { theme } = useTheme();
  const normalizedValue = value ?? "";
  const editorHeight = height ?? Math.max((rows ?? 6) * 24 + 64, 180);
  const colorMode = theme === "dark" ? "dark" : "light";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-input bg-transparent shadow-xs transition-[color,box-shadow]",
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      data-color-mode={colorMode}
    >
      <MDEditor
        value={normalizedValue}
        onChange={(next) => onChange?.(typeof next === "string" ? next : "")}
        preview={preview}
        hideToolbar={hideToolbar}
        commands={compactToolbar ? compactMarkdownCommands : undefined}
        extraCommands={compactToolbar ? compactMarkdownExtraCommands : undefined}
        visibleDragbar={false}
        height={editorHeight}
        enableScroll
        data-color-mode={colorMode}
        previewOptions={{
          remarkPlugins: [remarkGfm],
          rehypePlugins: [rehypeRaw],
          className: discordMarkdownClassName,
        } satisfies NonNullable<MDEditorProps["previewOptions"]>}
        textareaProps={{
          placeholder,
          disabled,
          maxLength,
        }}
      />
    </div>
  );
}
