"use client";

import * as React from "react";
import { Camera, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function uploadImage(file: File) {
  const uploadResponse = await fetch("/api/uploads", { method: "POST" });
  const uploadBody = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(uploadBody.error ?? "Unable to prepare the upload.");
  }

  const storageResponse = await fetch(uploadBody.uploadUrl, {
    method: "POST",
    headers: {
      "content-type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!storageResponse.ok) {
    throw new Error("Unable to upload the image.");
  }

  const { storageId } = await storageResponse.json();

  const urlResponse = await fetch("/api/uploads/url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storageId, filename: file.name }),
  });
  const urlBody = await urlResponse.json();
  if (!urlResponse.ok) {
    throw new Error(urlBody.error ?? "Unable to read the uploaded image URL.");
  }

  return urlBody.url as string;
}

export function AvatarPicker({
  value,
  onChange,
  fallback,
  label,
  buttonLabel,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  fallback: string;
  label: string;
  buttonLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const nextUrl = await uploadImage(file);
      onChange(nextUrl);
      toast.success(label);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload the image.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative">
        <Avatar className="size-20 rounded-2xl border border-border/60">
          <AvatarImage src={value} alt={label} />
          <AvatarFallback className="rounded-2xl text-lg font-semibold">{fallback}</AvatarFallback>
        </Avatar>
        <div className="absolute -right-2 -bottom-2 rounded-full border bg-background p-2 shadow-sm">
          {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">{label}</div>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={disabled || isUploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          {isUploading ? `${buttonLabel}...` : buttonLabel}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void handleFiles(event.target.files);
          }}
        />
      </div>
    </div>
  );
}
