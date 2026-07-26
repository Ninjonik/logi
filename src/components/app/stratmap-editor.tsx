"use client";

import { StratmapBoard } from "@/components/app/stratmap-editor/board";
import { StratmapLeftSidebar } from "@/components/app/stratmap-editor/left-sidebar";
import { StratmapRightSidebar } from "@/components/app/stratmap-editor/right-sidebar";
import { useStratmapEditor } from "@/components/app/stratmap-editor/use-stratmap-editor";
import type { StratmapEditorProps } from "@/components/app/stratmap-editor/types";

export function StratmapEditor({ locale: _locale, ...props }: StratmapEditorProps) {
  const editor = useStratmapEditor(props);

  return (
    <div ref={editor.rootRef} tabIndex={-1} onPointerDownCapture={() => editor.rootRef.current?.focus()} className="grid h-full gap-2 overflow-hidden xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      <StratmapLeftSidebar
        dictionary={props.dictionary}
        canAdmin={editor.canAdmin}
        isPending={editor.isPending}
        title={editor.title}
        description={editor.description}
        baseMapId={editor.baseMapId}
        side={editor.side}
        strongpointId={editor.strongpointId}
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
        onDeleteSlide={editor.deleteSlide}
        onOverlayChange={editor.handleOverlayChange}
        onToggleStrongpoint={editor.toggleStrongpoint}
      />
      <StratmapBoard
        dictionary={props.dictionary}
        svgRef={editor.svgRef}
        viewport={editor.viewport}
        tool={editor.tool}
        selectedMap={editor.selectedMap}
        activeSlide={editor.activeSlide}
        overlayStrongpointIds={editor.overlayStrongpointIds}
        selectedElementIds={editor.selectedElementIds}
        hoveredElementId={editor.hoveredElementId}
        dragState={editor.dragState}
        strokeColor={editor.strokeColor}
        fillColor={editor.fillColor}
        strokeWidth={editor.strokeWidth}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        selectionCount={editor.selectedElementIds.length}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onZoomIn={editor.zoomIn}
        onZoomOut={editor.zoomOut}
        onResetZoom={editor.resetZoom}
        onToolChange={editor.setTool}
        onWheel={editor.handleBoardWheel}
        onContextMenu={editor.handleBoardContextMenu}
        onPointerDown={editor.handlePointerDown}
        onPointerMove={editor.handlePointerMove}
        onPointerUp={editor.handlePointerUp}
        onPointerLeave={() => editor.setHoveredElementId(null)}
        onStartMove={editor.startMove}
        onHoverElement={editor.setHoveredElementId}
        onClearHover={(elementId) => editor.setHoveredElementId((current) => current === elementId ? null : current)}
        onRemoveSelected={editor.removeSelectedElements}
      />
      <StratmapRightSidebar
        dictionary={props.dictionary}
        canAdmin={editor.canAdmin}
        tool={editor.tool}
        strokeColor={editor.strokeColor}
        fillColor={editor.fillColor}
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
        onStrokeColorChange={editor.setStrokeColor}
        onFillColorChange={editor.setFillColor}
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
    </div>
  );
}
