"use client"

import {
    PanelLeftClose,
    PanelLeftOpen,
    PanelRightClose,
    PanelRightOpen,
} from "lucide-react"
import {
    useRef,
    useState,
    useSyncExternalStore,
    type CSSProperties,
} from "react"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    IconAttachmentViewer,
    type IconAttachmentViewerRequest,
} from "@/components/app/stratmap-editor/icon-attachment-viewer"
import type {
    StratmapEditorMode,
    StratmapEditorProps,
} from "@/components/app/stratmap-editor/types"
import { useStratmapEditor } from "@/components/app/stratmap-editor/use-stratmap-editor"
import { StratmapRightSidebar } from "@/components/app/stratmap-editor/right-sidebar"
import { EditorIconButton } from "@/components/app/stratmap-editor/editor-controls"
import { StratmapLeftSidebar } from "@/components/app/stratmap-editor/left-sidebar"
import { StratmapBoard } from "@/components/app/stratmap-editor/board"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * A side panel is "auto" until someone toggles it: open on wide screens and
 * closed on phones, decided by CSS so the server render matches the client.
 */
type PanelState = "auto" | "open" | "closed"

const WIDE_SCREEN_QUERY = "(min-width: 768px)"

function subscribeToScreenWidth(onChange: () => void) {
    const query = window.matchMedia(WIDE_SCREEN_QUERY)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
}

/** Whether the screen is at least 768 px wide; the server assumes it is. */
function useWideScreen() {
    return useSyncExternalStore(
        subscribeToScreenWidth,
        () => window.matchMedia(WIDE_SCREEN_QUERY).matches,
        () => true
    )
}

function isPanelVisible(state: PanelState, wideScreen: boolean) {
    return state === "open" || (state === "auto" && wideScreen)
}

/** On phones a panel floats over the map; from 768 px it is a grid column. */
function panelClassName(state: PanelState, side: "left" | "right") {
    return cn(
        "bg-background/95 absolute inset-y-0 z-30 flex min-h-0 w-[min(85vw,18rem)] flex-col p-1 shadow-xl backdrop-blur-sm md:static md:z-auto md:w-auto md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none [&>aside]:min-h-0 [&>aside]:flex-1",
        side === "left" ? "left-0 rounded-r-lg" : "right-0 rounded-l-lg",
        state === "auto" && "hidden md:flex",
        state === "closed" && "hidden"
    )
}

export function StratmapEditor({
    locale: _locale,
    ...props
}: StratmapEditorProps) {
    const [mode, setMode] = useState<StratmapEditorMode>(
        props.initialCanAdmin ? "edit" : "view"
    )
    const [leftPanel, setLeftPanel] = useState<PanelState>("auto")
    const [rightPanel, setRightPanel] = useState<PanelState>("auto")
    const leftSidebarOpen = leftPanel !== "closed"
    const rightSidebarOpen = rightPanel !== "closed"
    const labels = props.dictionary.stratmaps

    const wideScreen = useWideScreen()
    const leftVisible = isPanelVisible(leftPanel, wideScreen)
    const rightVisible = isPanelVisible(rightPanel, wideScreen)

    function togglePanel(side: "left" | "right") {
        const visible = side === "left" ? leftVisible : rightVisible
        const next: PanelState = visible ? "closed" : "open"
        if (side === "left") setLeftPanel(next)
        else setRightPanel(next)
        // Phones show one floating panel at a time.
        if (next === "open" && !wideScreen) {
            if (side === "left") setRightPanel("closed")
            else setLeftPanel("closed")
        }
    }

    function closeFloatingPanels() {
        if (leftPanel === "open") setLeftPanel("closed")
        if (rightPanel === "open") setRightPanel("closed")
    }
    const [attachmentViewerRequest, setAttachmentViewerRequest] =
        useState<IconAttachmentViewerRequest | null>(null)
    const editor = useStratmapEditor(props, mode)
    const slideBackgroundInputRef = useRef<HTMLInputElement | null>(null)

    return (
        <div
            ref={editor.rootRef}
            tabIndex={-1}
            onPointerDownCapture={() => editor.rootRef.current?.focus()}
            className="relative grid h-full grid-cols-[minmax(0,1fr)] gap-1.5 overflow-hidden md:[grid-template-columns:var(--stratmap-columns)]"
            style={
                {
                    "--stratmap-columns": `${leftSidebarOpen ? "212px " : ""}minmax(0,1fr)${rightSidebarOpen ? " 236px" : ""}`,
                } as CSSProperties
            }
        >
            {!wideScreen && (leftPanel === "open" || rightPanel === "open") ? (
                <button
                    type="button"
                    aria-label={
                        leftPanel === "open"
                            ? labels.hideLeftPanel
                            : labels.hideRightPanel
                    }
                    className="absolute inset-0 z-20 bg-black/30 md:hidden"
                    onClick={closeFloatingPanels}
                />
            ) : null}
            {leftSidebarOpen ? (
                <div className={panelClassName(leftPanel, "left")}>
                    <StratmapLeftSidebar
                        dictionary={props.dictionary}
                        canAdmin={editor.canAdmin}
                        isPending={editor.isPending}
                        title={editor.title}
                        description={editor.description}
                        gameId={props.initialStratmap.gameId}
                        baseMapId={editor.baseMapId}
                        side={editor.side}
                        strongpointId={editor.strongpointId}
                        maps={editor.maps}
                        slides={editor.state.slides}
                        selectedSlideId={editor.selectedSlideId}
                        selectedMap={editor.selectedMap}
                        activeOverlays={
                            editor.activeSlide?.overlays ?? {
                                showGrid: true,
                                showAllStrongpoints: true,
                                visibleStrongpointIds: [],
                                showOffensiveGarrisons: false,
                                overlayTeam: "a",
                                showArtillery: false,
                                showRepairStations: false,
                                showSpawnRanges: false,
                                showWardogsHqs: true,
                                showWardogsTowers: true,
                            }
                        }
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
                        onMoveSlide={(slideId, direction) =>
                            editor.moveSlide(slideId, direction)
                        }
                        onDeleteSlide={editor.deleteSlide}
                        onToggleStrongpoint={editor.toggleStrongpoint}
                        onToggleWardogsHqs={(showWardogsHqs) =>
                            editor.handleOverlayChange({ showWardogsHqs })
                        }
                        onToggleWardogsTowers={(showWardogsTowers) =>
                            editor.handleOverlayChange({ showWardogsTowers })
                        }
                    />
                </div>
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
                onClearHover={(elementId) =>
                    editor.setHoveredElementId((current) =>
                        current === elementId ? null : current
                    )
                }
                onOpenIconAttachments={(element) =>
                    setAttachmentViewerRequest((current) => ({
                        requestId: (current?.requestId ?? 0) + 1,
                        attachments:
                            element.attachments?.filter(
                                (attachment) => attachment.url
                            ) ?? [],
                        mainAttachmentUrl: element.mainAttachmentUrl,
                        fallbackNote: element.note,
                    }))
                }
                overlayControls={
                    <>
                        <EditorIconButton
                            icon={leftVisible ? PanelLeftClose : PanelLeftOpen}
                            label={
                                leftVisible
                                    ? labels.hideLeftPanel
                                    : labels.showLeftPanel
                            }
                            className="bg-background/85 pointer-events-auto size-7 shadow-sm backdrop-blur-sm"
                            onClick={() => togglePanel("left")}
                        />
                        <EditorIconButton
                            icon={
                                rightVisible ? PanelRightClose : PanelRightOpen
                            }
                            label={
                                rightVisible
                                    ? labels.hideRightPanel
                                    : labels.showRightPanel
                            }
                            className="bg-background/85 pointer-events-auto size-7 shadow-sm backdrop-blur-sm"
                            onClick={() => togglePanel("right")}
                        />
                    </>
                }
            />
            {rightSidebarOpen ? (
                <div className={panelClassName(rightPanel, "right")}>
                    <StratmapRightSidebar
                        dictionary={props.dictionary}
                        canAdmin={editor.canAdmin}
                        tool={editor.tool}
                        mode={mode}
                        onModeChange={setMode}
                        canUndo={editor.canUndo}
                        canRedo={editor.canRedo}
                        strokeColor={editor.strokeColor}
                        strokeWidth={editor.strokeWidth}
                        lineStyle={editor.lineStyle}
                        lineStartStyle={editor.lineStartStyle}
                        lineEndStyle={editor.lineEndStyle}
                        showLineDistance={editor.showLineDistance}
                        textValue={editor.textValue}
                        textSize={editor.textSize}
                        iconId={editor.iconId}
                        iconSize={editor.iconSize}
                        catalogGroups={editor.catalogGroups}
                        selectedElement={editor.selectedElement}
                        isUploadingIconAttachments={
                            editor.isUploadingIconAttachments
                        }
                        canEdit={editor.canEdit}
                        onUndo={editor.undo}
                        onRedo={editor.redo}
                        onZoomIn={editor.zoomIn}
                        onZoomOut={editor.zoomOut}
                        onResetZoom={editor.resetZoom}
                        onToolChange={editor.setTool}
                        onStrokeColorChange={editor.setStrokeColor}
                        onStrokeWidthChange={editor.setStrokeWidth}
                        onLineStyleChange={editor.setLineStyle}
                        onLineStartStyleChange={editor.setLineStartStyle}
                        onLineEndStyleChange={editor.setLineEndStyle}
                        onShowLineDistanceChange={editor.setShowLineDistance}
                        onTextValueChange={editor.setTextValue}
                        onTextSizeChange={editor.setTextSize}
                        onIconChange={editor.setIconId}
                        onIconSizeChange={editor.setIconSize}
                        onSelectedElementChange={
                            editor.handleSelectedElementChange
                        }
                        onUpload={(event) =>
                            void editor.handleSelectedIconAttachmentUpload(
                                event
                            )
                        }
                    />
                </div>
            ) : null}
            <IconAttachmentViewer request={attachmentViewerRequest} />
            <Dialog
                open={editor.isCreateSlideModalOpen}
                onOpenChange={(open) => {
                    if (!open) editor.closeCreateSlideModal()
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {props.dictionary.stratmaps.createSlideTitle ??
                                "Create slide"}
                        </DialogTitle>
                        <DialogDescription>
                            {props.dictionary.stratmaps
                                .createSlideDescription ??
                                "Add a slide name and optionally upload a custom background image."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="slide-name">
                                {props.dictionary.stratmaps.slideNameLabel ??
                                    "Slide name"}
                            </Label>
                            <Input
                                id="slide-name"
                                value={editor.newSlideName}
                                onChange={(event) =>
                                    editor.setNewSlideName(event.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>
                                {props.dictionary.stratmaps
                                    .customBackgroundLabel ??
                                    "Custom background image"}
                            </Label>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        slideBackgroundInputRef.current?.click()
                                    }
                                    disabled={editor.isUploadingSlideBackground}
                                >
                                    {props.dictionary.common.upload}
                                </Button>
                                <span className="text-muted-foreground text-xs">
                                    {editor.pendingSlideBackground?.kind ===
                                    "image"
                                        ? `${editor.pendingSlideBackground.imageFilename} (${editor.pendingSlideBackground.imageWidth}x${editor.pendingSlideBackground.imageHeight})`
                                        : (props.dictionary.stratmaps
                                              .customBackgroundHint ??
                                          "Leave empty to use the map background for this slide.")}
                                </span>
                            </div>
                            <input
                                ref={slideBackgroundInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) =>
                                    void editor.handleSlideBackgroundUpload(
                                        event
                                    )
                                }
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={editor.closeCreateSlideModal}
                            disabled={editor.isUploadingSlideBackground}
                        >
                            {props.dictionary.common.cancel}
                        </Button>
                        <Button
                            onClick={editor.confirmCreateSlide}
                            disabled={editor.isUploadingSlideBackground}
                        >
                            {props.dictionary.stratmaps.createSlideAction ??
                                "Create slide"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
