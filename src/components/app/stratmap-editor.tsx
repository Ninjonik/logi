"use client";

import { useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

import { StratmapBoard } from "@/components/app/stratmap-editor/board";
import { EditorIconButton } from "@/components/app/stratmap-editor/editor-controls";
import { IconAttachmentViewer, type IconAttachmentViewerRequest } from "@/components/app/stratmap-editor/icon-attachment-viewer";
import { StratmapLeftSidebar } from "@/components/app/stratmap-editor/left-sidebar";
import { StratmapRightSidebar } from "@/components/app/stratmap-editor/right-sidebar";
import { useStratmapEditor } from "@/components/app/stratmap-editor/use-stratmap-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StratmapEditorMode, StratmapEditorProps } from "@/components/app/stratmap-editor/types";

export function StratmapEditor({ locale: _locale, ...props }: StratmapEditorProps) {
  const [mode, setMode] = useState<StratmapEditorMode>(props.initialCanAdmin ? "edit" : "view");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [attachmentViewerRequest, setAttachmentViewerRequest] = useState<IconAttachmentViewerRequest | null>(null);
  const editor = useStratmapEditor(props, mode);
  const slideBackgroundInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      ref={editor.rootRef}
      tabIndex={-1}
      onPointerDownCapture={() => editor.rootRef.current?.focus()}
      className="grid h-full gap-1.5 overflow-hidden"
      style={{
        gridTemplateColumns: `${leftSidebarOpen ? "212px " : ""}minmax(0,1fr)${rightSidebarOpen ? " 236px" : ""}`,
      }}
    >
      {leftSidebarOpen ? (
        <StratmapLeftSidebar
          dictionary={props.dictionary}
          canAdmin={editor.canAdmin}
          isPending={editor.isPending}
          title={editor.title}
          description={editor.description}
          baseMapId={editor.baseMapId}
          side={editor.side}
          strongpointId={editor.strongpointId}
          maps={editor.maps}
          slides={editor.state.slides}
          selectedSlideId={editor.selectedSlideId}
          selectedMap={editor.selectedMap}
          activeOverlays={editor.activeSlide?.overlays ?? { showGrid: true, showAllStrongpoints: true, visibleStrongpointIds: [], showOffensiveGarrisons: false, overlayTeam: "a", showArtillery: false, showRepairStations: false, showSpawnRanges: false }}
          onTitleChange={editor.setTitle}
          onDescriptionChange={editor.setDescription}
          onBaseMapChange={editor.handleBaseMapChange}
          onStrongpointChange={editor.setStrongpointId}
          onSideChange={editor.setSide}
          onSaveMeta={editor.saveMeta}
          onSelectSlide={editor.setSelectedSlideId}
          onAddSlide={editor.addSlide}
          onDuplicateSlide={editor.duplicateSlide}
          onRenameSlide={editor.renameSlide}
          onMoveSlide={(slideId, direction) => editor.moveSlide(slideId, direction)}
          onDeleteSlide={editor.deleteSlide}
          onToggleStrongpoint={editor.toggleStrongpoint}
        />
      ) : null}
      <StratmapBoard
        svgRef={editor.svgRef}
        viewport={editor.viewport}
        tool={editor.tool}
        mode={mode}
        selectedMap={editor.selectedMap}
        activeSlide={editor.activeSlide}
        overlayStrongpointIds={editor.overlayStrongpointIds}
        selectedElementIds={editor.selectedElementIds}
        hoveredElementId={editor.hoveredElementId}
        dragState={editor.dragState}
        strokeColor={editor.strokeColor}
        fillColor={editor.fillColor}
        strokeWidth={editor.strokeWidth}
        onWheel={editor.handleBoardWheel}
        onContextMenu={editor.handleBoardContextMenu}
        onPointerDown={editor.handlePointerDown}
        onPointerMove={editor.handlePointerMove}
        onPointerUp={editor.handlePointerUp}
        onPointerLeave={() => editor.setHoveredElementId(null)}
        onStartMove={editor.startMove}
        onHoverElement={editor.setHoveredElementId}
        onClearHover={(elementId) => editor.setHoveredElementId((current) => current === elementId ? null : current)}
        onOpenIconAttachments={(element) => setAttachmentViewerRequest((current) => ({
          requestId: (current?.requestId ?? 0) + 1,
          attachments: element.attachments?.filter((attachment) => attachment.url) ?? [],
          mainAttachmentUrl: element.mainAttachmentUrl,
          fallbackNote: element.note,
        }))}
        overlayControls={
          <>
            <EditorIconButton
              icon={leftSidebarOpen ? PanelLeftClose : PanelLeftOpen}
              label={leftSidebarOpen ? "Collapse left sidebar" : "Expand left sidebar"}
              className="pointer-events-auto size-7 bg-background/85 shadow-sm backdrop-blur-sm"
              onClick={() => setLeftSidebarOpen((current) => !current)}
            />
            <EditorIconButton
              icon={rightSidebarOpen ? PanelRightClose : PanelRightOpen}
              label={rightSidebarOpen ? "Collapse right sidebar" : "Expand right sidebar"}
              className="pointer-events-auto size-7 bg-background/85 shadow-sm backdrop-blur-sm"
              onClick={() => setRightSidebarOpen((current) => !current)}
            />
          </>
        }
      />
      {rightSidebarOpen ? (
        <StratmapRightSidebar
          dictionary={props.dictionary}
          canAdmin={editor.canAdmin}
          tool={editor.tool}
          mode={mode}
          onModeChange={setMode}
          canUndo={editor.canUndo}
          canRedo={editor.canRedo}
          strokeWidth={editor.strokeWidth}
          lineStyle={editor.lineStyle}
          lineStartStyle={editor.lineStartStyle}
          lineEndStyle={editor.lineEndStyle}
          showLineDistance={editor.showLineDistance}
          textValue={editor.textValue}
          textSize={editor.textSize}
          iconId={editor.iconId}
          catalogGroups={editor.catalogGroups}
          selectedElement={editor.selectedElement}
          isUploadingIconAttachments={editor.isUploadingIconAttachments}
          canEdit={editor.canEdit}
          onUndo={editor.undo}
          onRedo={editor.redo}
          onZoomIn={editor.zoomIn}
          onZoomOut={editor.zoomOut}
          onResetZoom={editor.resetZoom}
          onToolChange={editor.setTool}
          onStrokeWidthChange={editor.setStrokeWidth}
          onLineStyleChange={editor.setLineStyle}
          onLineStartStyleChange={editor.setLineStartStyle}
          onLineEndStyleChange={editor.setLineEndStyle}
          onShowLineDistanceChange={editor.setShowLineDistance}
          onTextValueChange={editor.setTextValue}
          onTextSizeChange={editor.setTextSize}
          onIconChange={editor.setIconId}
          onSelectedElementChange={editor.handleSelectedElementChange}
          onUpload={(event) => void editor.handleSelectedIconAttachmentUpload(event)}
        />
      ) : null}
      <IconAttachmentViewer request={attachmentViewerRequest} />
      <Dialog open={editor.isCreateSlideModalOpen} onOpenChange={(open) => { if (!open) editor.closeCreateSlideModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{props.dictionary.stratmaps.createSlideTitle ?? "Create slide"}</DialogTitle>
            <DialogDescription>{props.dictionary.stratmaps.createSlideDescription ?? "Add a slide name and optionally upload a custom background image."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="slide-name">{props.dictionary.stratmaps.slideNameLabel ?? "Slide name"}</Label>
              <Input id="slide-name" value={editor.newSlideName} onChange={(event) => editor.setNewSlideName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{props.dictionary.stratmaps.customBackgroundLabel ?? "Custom background image"}</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => slideBackgroundInputRef.current?.click()} disabled={editor.isUploadingSlideBackground}>
                  {props.dictionary.common.upload}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {editor.pendingSlideBackground?.kind === "image"
                    ? `${editor.pendingSlideBackground.imageFilename} (${editor.pendingSlideBackground.imageWidth}x${editor.pendingSlideBackground.imageHeight})`
                    : (props.dictionary.stratmaps.customBackgroundHint ?? "Leave empty to use the map background for this slide.")}
                </span>
              </div>
              <input ref={slideBackgroundInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void editor.handleSlideBackgroundUpload(event)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={editor.closeCreateSlideModal} disabled={editor.isUploadingSlideBackground}>
              {props.dictionary.common.cancel}
            </Button>
            <Button onClick={editor.confirmCreateSlide} disabled={editor.isUploadingSlideBackground}>
              {props.dictionary.stratmaps.createSlideAction ?? "Create slide"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
