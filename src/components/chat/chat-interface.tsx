"use client";

import { useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { FilterChips } from "@/components/chat/filter-chips";
import { formatChipLabel } from "@/components/chat/filter-chips.logic";
import { useChatState } from "@/components/chat/use-chat-state";
import { RollImageGrid } from "@/components/roll/roll-image-grid";
import { Darkroom } from "@/components/roll/darkroom";
import { PreviewPanel } from "@/components/chat/preview-panel";
import { getImageUrl } from "@/lib/imagekit/url";
import type { QueryPlan } from "@/lib/gemini/query";
import type { Image as ImageRecord } from "@/types/domain";

const UNIVERSAL_SUGGESTIONS = [
  "Show me the best shots",
  "Find all portraits",
  "What's in this roll?",
];

type Props = {
  rollId: string;
  rollName: string;
  initialImages: ImageRecord[];
  rollSuggestions: string[];
};

export function ChatInterface({
  rollId,
  rollName,
  initialImages,
  rollSuggestions,
}: Props) {
  const state = useChatState({ rollId, initialImages });
  const {
    input,
    setInput,
    sending,
    processing,
    resultImageIds,
    selectedImageIds,
    activePlan,
    followups,
    liveImages,
    setLiveImages,
    darkroom,
    setDarkroom,
    previewOpen,
    setPreviewOpen,
    imageMap,
    previewImages,
    handleSend,
    handleChipSend,
    toggleSelected,
    deselect,
    showAll,
    openDarkroom,
    handleFilterModify,
    selectionIdlePrompt,
  } = state;

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const liveImageCount = liveImages.length;
  const suggestions =
    rollSuggestions.length > 0 ? rollSuggestions : UNIVERSAL_SUGGESTIONS;
  const canPreview = previewImages.length > 0;
  const hasActiveFilter = activePlan !== null && activePlan.filters.length > 0;

  // Space opens preview when focus is outside text fields
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== " " || !canPreview) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      setPreviewOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canPreview, setPreviewOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* ---- IMAGE CANVAS ---- */}
      <div className="flex-1 overflow-y-auto pb-48">
        {liveImageCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 select-none pointer-events-none">
            <p className="text-4xl font-medium text-primary-200">{rollName}</p>
            <p className="text-sm text-primary-400">
              Drop images anywhere to start
            </p>
          </div>
        ) : (
          <>
            {resultImageIds !== null && (
              <ActiveFilterLine
                plan={activePlan}
                matched={resultImageIds.length}
                total={liveImageCount}
                onClear={showAll}
              />
            )}
            <RollImageGrid
              rollId={rollId}
              initialImages={initialImages}
              resultImageIds={resultImageIds}
              selectedImageIds={selectedImageIds}
              onImageClick={(id, isModified) =>
                isModified ? toggleSelected(id) : openDarkroom(id)
              }
              onImagesChange={(imgs) => setLiveImages(imgs)}
            />
          </>
        )}
      </div>

      {/* ---- BOTTOM BAR ---- */}
      <div className="absolute bottom-0 inset-x-0 flex justify-center pointer-events-none">
        <div className="w-full max-w-2xl px-4 pb-5 flex flex-col gap-2 pointer-events-auto">


          {/* Idle selection nudge — surfaces after 2+ images selected for >3s */}
          {selectionIdlePrompt && !hasActiveFilter && (
            <p className="text-sm text-primary-400 truncate px-1 animate-bloom">
              Find images similar to these — or type to refine.
            </p>
          )}

          {/* Follow-up ghost line */}
          {followups.length > 0 && !hasActiveFilter && !selectionIdlePrompt && (
            <p className="text-sm text-primary-400 truncate px-1">
              {followups[0]}
            </p>
          )}

          {/* Active filter chips */}
          {hasActiveFilter && activePlan && (
            <FilterChips
              plan={activePlan}
              disabled={sending}
              onModify={(mods) => handleFilterModify(activePlan, mods)}
            />
          )}

          {/* Input container — Claude.ai-style card */}
          <div className="rounded-2xl border border-primary-200 bg-white shadow-sm">

            {/* Selection strip inside the box, above the textarea */}
            {selectedImageIds.length > 0 && (
              <div className="px-4 pt-3">
                <SelectionStrip
                  selectedIds={selectedImageIds}
                  imageMap={imageMap}
                  onDeselect={deselect}
                  onClear={showAll}
                />
              </div>
            )}

            {/* Textarea row */}
            <div className="px-4 pt-3 pb-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedImageIds.length > 0
                    ? "Find images similar to these…"
                    : "Ask about this roll…"
                }
                rows={1}
                disabled={sending}
                className="w-full text-base resize-none bg-transparent outline-none placeholder:text-primary-200 disabled:opacity-50"
                style={{ minHeight: "1.5rem", maxHeight: "8rem" }}
              />
            </div>

            {/* Bottom action row */}
            <div className="px-3 pb-3 flex items-center justify-between">
              {/* Status / result count */}
              <div className="text-sm tabular-nums text-primary-400 flex items-center gap-2">
                {processing ? (
                  <span className="animate-pulse">Searching…</span>
                ) : resultImageIds !== null ? (
                  <>
                    <span>{resultImageIds.length} of {liveImageCount}</span>
                    <button onClick={showAll} className="animate-swiss hover:text-primary-900 underline">
                      show all
                    </button>
                    {canPreview && (
                      <button onClick={() => setPreviewOpen(true)} className="animate-swiss hover:text-primary-900 underline">
                        preview
                      </button>
                    )}
                  </>
                ) : null}
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-900 text-white animate-swiss hover:opacity-80 disabled:opacity-20"
                aria-label="Send"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M7 12V2M2 7l5-5 5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Suggestion chips — only on empty state */}
          {!hasActiveFilter && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleChipSend(s)}
                  disabled={sending}
                  className="text-sm border border-primary-200 rounded-full px-3 py-1.5 animate-swiss hover:bg-primary-100 hover:border-primary-800 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {darkroom && (
        <Darkroom
          images={darkroom.images}
          initialIndex={darkroom.index}
          onClose={() => setDarkroom(null)}
        />
      )}

      {previewOpen && (
        <PreviewPanel
          images={previewImages}
          rollId={rollId}
          onClose={() => setPreviewOpen(false)}
          onGallerySaved={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

// ---- Sub-components ---- //


function ActiveFilterLine({
  plan,
  matched,
  total,
  onClear,
}: {
  plan: QueryPlan | null;
  matched: number;
  total: number;
  onClear: () => void;
}) {
  const summary =
    plan && plan.filters.length > 0
      ? plan.filters.map(formatChipLabel).join(" · ")
      : "filtered";

  return (
    <div className="flex items-center gap-2 px-4 pt-4 text-sm text-primary-400 tabular-nums">
      <span>
        {summary} · {matched} of {total}
      </span>
      <button
        onClick={onClear}
        className="animate-swiss hover:text-primary-900 leading-none"
        aria-label="Clear filter"
      >
        ×
      </button>
    </div>
  );
}

function SelectionStrip({
  selectedIds,
  imageMap,
  onDeselect,
  onClear,
}: {
  selectedIds: string[];
  imageMap: Map<string, ImageRecord>;
  onDeselect: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto mb-1.5 animate-bloom">
      {selectedIds.map((id) => {
        const img = imageMap.get(id);
        if (!img) return null;
        const src = getImageUrl(img.storage_key, { width: 48, quality: 70 });
        return (
          <div key={id} className="relative group shrink-0 w-6 h-6">
            <Image
              src={src}
              alt={img.original_filename ?? ""}
              width={24}
              height={24}
              className="w-6 h-6 rounded-sm object-cover"
            />
            <button
              onClick={() => onDeselect(id)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 animate-swiss"
              aria-label="Deselect"
            >
              ×
            </button>
          </div>
        );
      })}
      <span className="text-sm tabular-nums text-primary-400 shrink-0">
        {selectedIds.length} selected
      </span>
      <button
        onClick={onClear}
        className="text-sm text-primary-400 animate-swiss hover:text-primary-900 shrink-0"
        aria-label="Clear selection"
      >
        Clear
      </button>
    </div>
  );
}
