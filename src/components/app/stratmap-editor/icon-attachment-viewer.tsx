"use client";

import { useState } from "react";
import { PhotoSlider } from "react-photo-view";

import type { StratmapElementAttachment } from "@/lib/stratmaps";

import { LightboxCaption } from "./selection-inspector";

export type IconAttachmentViewerRequest = {
  requestId: number;
  attachments: StratmapElementAttachment[];
  mainAttachmentUrl?: string;
  fallbackNote?: string;
};

export function IconAttachmentViewer({ request }: { request: IconAttachmentViewerRequest | null }) {
  if (!request || !request.attachments.length) return null;
  return <RequestedIconAttachmentViewer key={request.requestId} request={request} />;
}

function RequestedIconAttachmentViewer({ request }: { request: IconAttachmentViewerRequest }) {
  const { attachments } = request;
  const [visible, setVisible] = useState(true);
  const [index, setIndex] = useState(() => Math.max(0, attachments.findIndex((attachment) => attachment.url === request.mainAttachmentUrl)));

  return (
    <PhotoSlider
      images={attachments.map((attachment, attachmentIndex) => ({
        key: `${attachment.url}-${attachmentIndex}`,
        src: attachment.url,
      }))}
      index={index}
      visible={visible}
      onIndexChange={setIndex}
      onClose={() => setVisible(false)}
      loop
      maskOpacity={0.92}
      overlayRender={({ index: activeIndex }) => (
        <LightboxCaption text={attachments[activeIndex]?.description?.trim() || request.fallbackNote?.trim() || ""} />
      )}
    />
  );
}
