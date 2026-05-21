"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import {
  sendMessage,
  getChatHistory,
  rerunWithModifiedFilters,
} from "@/actions/chat";
import { FilterChips } from "@/components/chat/filter-chips";
import { formatChipLabel } from "@/components/chat/filter-chips.logic";
import type { FilterMod } from "@/actions/chat";
import type { QueryPlan } from "@/lib/gemini/query";
import { RollImageGrid } from "@/components/roll/roll-image-grid";
import { Darkroom } from "@/components/roll/darkroom";
import { PreviewPanel } from "@/components/chat/preview-panel";
import { getImageUrl } from "@/lib/imagekit/url";
import type {
  ChatMessageWithResults,
  Image as ImageRecord,
} from "@/types/domain";

import {
  GALLERY_INTENT_RE,
  derivePreviewImages,
} from "@/components/chat/chat-interface.logic";

const UNIVERSAL_SUGGESTIONS = [
  "Show me the best shots",
  "Find all portraits",
  "What's in this roll?",
];

type MessageWithFollowups = ChatMessageWithResults & {
  followups?: string[];
  galleryLink?: string;
};

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
  const [messages, setMessages] = useState<MessageWithFollowups[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [resultImageIds, setResultImageIds] = useState<string[] | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [activePlan, setActivePlan] = useState<QueryPlan | null>(null);
  const [liveImages, setLiveImages] = useState<ImageRecord[]>(initialImages);
  const liveImageCount = liveImages.length;

  const [darkroom, setDarkroom] = useState<{
    images: ImageRecord[];
    index: number;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  const suggestions =
    rollSuggestions.length > 0 ? rollSuggestions : UNIVERSAL_SUGGESTIONS;

  const openDarkroom = useCallback(
    (imageId: string, contextImages: ImageRecord[]) => {
      const index = contextImages.findIndex((img) => img.id === imageId);
      if (index === -1) return;
      setDarkroom({ images: contextImages, index });
    },
    [],
  );

  useEffect(() => {
    getChatHistory(rollId)
      .then((history) => {
        setMessages(history as MessageWithFollowups[]);
        const lastWithResults = [...history]
          .reverse()
          .find(
            (m) =>
              m.role === "assistant" &&
              m.result_image_ids &&
              m.result_image_ids.length > 0,
          );
        if (lastWithResults?.result_image_ids) {
          setResultImageIds(lastWithResults.result_image_ids as string[]);
        }
        const lastWithPlan = [...history]
          .reverse()
          .find((m) => m.role === "assistant" && m.interpreted_filter);
        if (lastWithPlan?.interpreted_filter) {
          setActivePlan(lastWithPlan.interpreted_filter as QueryPlan);
        }
      })
      .catch(console.error)
      .finally(() => setHistoryLoaded(true));
  }, [rollId]);

  // Scroll history drawer to bottom when it opens or new messages arrive
  useEffect(() => {
    if (historyOpen)
      historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historyOpen, messages]);

  const submitMessage = useCallback(
    async (text: string, refIds?: string[], freshStart = false) => {
      setSending(true);
      setProcessing(true);

      const tempId = `temp-${Date.now()}`;
      const optimisticMsg: MessageWithFollowups = {
        id: tempId,
        roll_id: rollId,
        user_id: "",
        role: "user",
        content: text,
        result_image_ids: null,
        interpreted_filter: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      const activeFilters =
        !freshStart && !refIds && activePlan ? activePlan.filters : undefined;

      try {
        const result = await sendMessage(rollId, text, refIds, activeFilters);
        const assistantMsg: MessageWithFollowups = {
          ...(result.assistantMessage as ChatMessageWithResults),
          followups: result.followups,
        };
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          result.userMessage as MessageWithFollowups,
          assistantMsg,
        ]);
        setResultImageIds(result.images.map((img) => img.id));
        if (result.interpretedFilter) setActivePlan(result.interpretedFilter);
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } finally {
        setSending(false);
        setProcessing(false);
      }
    },
    [rollId, activePlan],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");

    if (GALLERY_INTENT_RE.test(text)) {
      window.dispatchEvent(new CustomEvent("hypermood:open-galleries"));
      return;
    }

    const refIds = selectedImageIds.length > 0 ? selectedImageIds : undefined;
    setSelectedImageIds([]);
    await submitMessage(text, refIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, sending, selectedImageIds, submitMessage]);

  const handleChipSend = useCallback(
    (text: string) => {
      if (sending) return;
      submitMessage(text);
    },
    [sending, submitMessage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const toggleSelected = useCallback((id: string) => {
    setSelectedImageIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const deselect = useCallback((id: string) => {
    setSelectedImageIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const showAll = useCallback(() => {
    setResultImageIds(null);
    setSelectedImageIds([]);
    setActivePlan(null);
  }, []);

  const handleFilterModify = useCallback(
    async (messageId: string, plan: QueryPlan, modifications: FilterMod[]) => {
      if (sending) return;
      setSending(true);
      setProcessing(true);

      try {
        const result = await rerunWithModifiedFilters(
          rollId,
          plan,
          modifications,
        );
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === messageId);
          const updatedMsg: MessageWithFollowups = {
            ...(result.assistantMessage as ChatMessageWithResults),
            id: messageId,
          };
          if (idx === -1) return [...prev, updatedMsg];
          const next = [...prev];
          next[idx] = updatedMsg;
          return next;
        });
        setResultImageIds(result.images.map((img) => img.id));
        setActivePlan(result.interpretedFilter);
      } catch {
        // Future: surface a toast here
      } finally {
        setSending(false);
        setProcessing(false);
      }
    },
    [rollId, sending],
  );

  const imageMap = useMemo(
    () => new Map(liveImages.map((img) => [img.id, img])),
    [liveImages],
  );
  const previewImages = useMemo<ImageRecord[]>(
    () =>
      derivePreviewImages({
        selectedImageIds,
        resultImageIds,
        liveImages,
        imageMap,
      }),
    [selectedImageIds, resultImageIds, liveImages, imageMap],
  );

  const canPreview = previewImages.length > 0;
  const hasActiveFilter = activePlan !== null && activePlan.filters.length > 0;
  const hasConversation = historyLoaded && messages.length > 0;
  const lastAssistantMsg = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  const handleGallerySaved = useCallback(
    (slug: string) => {
      const confirmMsg: MessageWithFollowups = {
        id: `gallery-${Date.now()}`,
        roll_id: rollId,
        user_id: "local",
        role: "assistant",
        content: `Gallery saved → /g/${slug}`,
        result_image_ids: null,
        interpreted_filter: null,
        created_at: new Date().toISOString(),
        galleryLink: `/g/${slug}`,
      };
      setMessages((prev) => [...prev, confirmMsg]);
    },
    [rollId],
  );

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
  }, [canPreview]);

  return (
    // Full-height canvas — images take everything, bar floats at the bottom
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* ── IMAGE CANVAS ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-(--bar-height,180px)">
        {liveImageCount === 0 && historyLoaded ? (
          // Empty state — whole canvas is the drop target (handled by AmbientUpload above)
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
              onImageClick={toggleSelected}
              onImagesChange={(imgs) => setLiveImages(imgs)}
              onFullscreen={openDarkroom}
            />
          </>
        )}
      </div>

      {/* ── FLOATING BAR ─────────────────────────────────────────────────────── */}
      {/* Outer shell: transparent backdrop, centered, max-width so it doesn't
          stretch edge-to-edge on wide screens */}
      <div className="absolute bottom-0 inset-x-0 flex justify-center px-6 pb-6 pt-4 bg-white/80 backdrop-blur-sm">
        <div className="w-full max-w-3xl flex flex-col gap-0 bg-white rounded-3xl border border-primary-200 shadow-sm overflow-hidden">
          {/* ── TOP SECTION: chips live inside the box ── */}
          {(hasActiveFilter ||
            (!hasConversation && historyLoaded) ||
            (lastAssistantMsg?.followups?.length ?? 0) > 0 ||
            selectedImageIds.length > 0) && (
            <div className="px-5 pt-4 pb-0 flex flex-col gap-2">
              {/* Selected image thumbnails */}
              {selectedImageIds.length > 0 && (
                <SelectionStrip
                  selectedIds={selectedImageIds}
                  imageMap={imageMap}
                  onDeselect={deselect}
                />
              )}

              {/* Active filter chips */}
              {hasActiveFilter && activePlan && (
                <FilterChips
                  plan={activePlan}
                  disabled={sending}
                  onModify={(mods) => {
                    if (!lastAssistantMsg) return;
                    handleFilterModify(lastAssistantMsg.id, activePlan, mods);
                  }}
                />
              )}

              {/* Follow-up suggestions from last query */}
              {!hasActiveFilter &&
                (lastAssistantMsg?.followups?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {lastAssistantMsg!.followups!.map((f) => (
                      <button
                        key={f}
                        onClick={() => handleChipSend(f)}
                        disabled={sending}
                        className="text-sm border border-primary-200 rounded-full px-3 py-1 animate-swiss hover:bg-primary-100 disabled:opacity-50"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}

              {/* Universal suggestions — only before first query */}
              {!hasConversation && historyLoaded && !hasActiveFilter && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleChipSend(s)}
                      disabled={sending}
                      className="text-sm border border-primary-200 rounded-full px-3 py-1 animate-swiss hover:bg-primary-100 disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── INPUT ── */}
          <div className="px-5 pt-4 pb-3">
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
              className="w-full text-base resize-none bg-transparent outline-none placeholder:text-primary-300 disabled:opacity-50"
              style={{ minHeight: "1.75rem" }}
            />
          </div>

          {/* ── BOTTOM ROW: status + actions inside the box ── */}
          <div className="flex items-center gap-3 px-5 pb-4">
            {/* Status */}
            <div className="flex-1 flex items-center gap-2">
              {processing ? (
                <span className="text-sm tabular-nums text-primary-400 animate-pulse">
                  Searching…
                </span>
              ) : resultImageIds !== null ? (
                <>
                  <span className="text-sm tabular-nums text-primary-400">
                    {resultImageIds.length} of {liveImageCount}
                  </span>
                  <button
                    onClick={showAll}
                    className="text-sm tabular-nums text-primary-400 animate-swiss hover:text-primary-900 underline"
                  >
                    show all
                  </button>
                  {canPreview && (
                    <button
                      onClick={() => setPreviewOpen(true)}
                      className="text-sm tabular-nums text-primary-400 animate-swiss hover:text-primary-900 underline"
                    >
                      preview
                    </button>
                  )}
                </>
              ) : (
                <span className="text-sm tabular-nums text-primary-400">
                  {liveImageCount > 0 ? `${liveImageCount} ${liveImageCount === 1 ? 'image' : 'images'}` : ""}
                </span>
              )}
            </div>

            {/* History toggle */}
            {hasConversation && (
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                className="text-sm text-primary-400 animate-swiss hover:text-primary-900"
              >
                {historyOpen ? "close" : "history"}
              </button>
            )}

            {/* Send button — always visible, dims when no input */}
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-primary-900 text-white animate-swiss hover:opacity-80 disabled:opacity-20 transition-opacity"
              aria-label="Send"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
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
      </div>

      {/* ── HISTORY DRAWER ───────────────────────────────────────────────────── */}
      {historyOpen && (
        <div
          className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-primary-100 flex flex-col animate-bloom"
          style={{ maxHeight: "60vh" }}
        >
          <div className="flex items-center justify-between px-6 py-3 border-b border-primary-100 shrink-0">
            <span className="text-sm text-primary-400">history</span>
            <button
              onClick={() => setHistoryOpen(false)}
              className="text-sm text-primary-400 animate-swiss hover:text-primary-900"
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-3">
            {messages.map((msg) => (
              <HistoryBubble key={msg.id} message={msg} />
            ))}
            <div ref={historyEndRef} />
          </div>
        </div>
      )}

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
          onGallerySaved={handleGallerySaved}
        />
      )}
    </div>
  );
}

// Read-only bubble for the history drawer — no chips or filter interaction
function HistoryBubble({ message }: { message: MessageWithFollowups }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] text-base px-3 py-2 rounded-xl ${
          isUser ? "bg-primary-100" : "bg-white border border-primary-100"
        }`}
      >
        {message.galleryLink ? (
          <p>
            Gallery saved →{" "}
            <a
              href={message.galleryLink}
              className="text-semantic-info underline animate-swiss hover:opacity-70"
              target="_blank"
              rel="noopener noreferrer"
            >
              {message.galleryLink}
            </a>
          </p>
        ) : (
          <p>{message.content}</p>
        )}
      </div>
    </div>
  );
}

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
}: {
  selectedIds: string[];
  imageMap: Map<string, ImageRecord>;
  onDeselect: (id: string) => void;
}) {
  return (
    <div className="animate-bloom flex items-center gap-2 overflow-x-auto">
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
    </div>
  );
}
