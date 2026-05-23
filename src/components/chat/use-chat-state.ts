"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  sendMessage,
  getLastRollState,
  rerunWithModifiedFilters,
} from "@/actions/chat";
import { derivePreviewImages } from "@/components/chat/chat-interface.logic";
import type { FilterMod } from "@/actions/chat";
import type { QueryPlan } from "@/lib/gemini/query";
import type { Image as ImageRecord } from "@/types/domain";

type Props = {
  rollId: string;
  initialImages: ImageRecord[];
};

export function useChatState({ rollId, initialImages }: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [resultImageIds, setResultImageIds] = useState<string[] | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [activePlan, setActivePlan] = useState<QueryPlan | null>(null);
  const [liveImages, setLiveImages] = useState<ImageRecord[]>(initialImages);
  const [followups, setFollowups] = useState<string[]>([]);

  const [darkroom, setDarkroom] = useState<{
    images: ImageRecord[];
    index: number;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectionIdlePrompt, setSelectionIdlePrompt] = useState(false);
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable refs so openDarkroom doesn't stale-close over state
  const liveImagesRef = useRef(liveImages);
  liveImagesRef.current = liveImages;
  const resultImageIdsRef = useRef(resultImageIds);
  resultImageIdsRef.current = resultImageIds;

  // Restore last result set + active plan from the most recent assistant message
  useEffect(() => {
    getLastRollState(rollId)
      .then(({ resultImageIds: ids, activePlan: plan }) => {
        if (ids) setResultImageIds(ids);
        if (plan) setActivePlan(plan);
      })
      .catch(console.error);
  }, [rollId]);

  // Show a ghost prompt when ≥2 images are selected and idle for >3s
  useEffect(() => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    if (selectedImageIds.length >= 2) {
      selectionTimerRef.current = setTimeout(() => setSelectionIdlePrompt(true), 3000);
    } else {
      setSelectionIdlePrompt((prev) => prev ? false : prev);
    }
    return () => {
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    };
  }, [selectedImageIds]);

  const submitMessage = useCallback(
    async (text: string, refIds?: string[], freshStart = false) => {
      setSending(true);
      setProcessing(true);
      setFollowups([]);

      const activeFilters =
        !freshStart && !refIds && activePlan ? activePlan.filters : undefined;

      try {
        const result = await sendMessage(rollId, text, refIds, activeFilters);
        setResultImageIds(result.images.map((img) => img.id));
        if (result.interpretedFilter) setActivePlan(result.interpretedFilter);
        if (result.followups?.length) setFollowups(result.followups);
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
    const refIds = selectedImageIds.length > 0 ? selectedImageIds : undefined;
    setSelectedImageIds([]);
    await submitMessage(text, refIds);
  }, [input, sending, selectedImageIds, submitMessage]);

  const handleChipSend = useCallback(
    (text: string) => {
      if (sending) return;
      submitMessage(text);
    },
    [sending, submitMessage],
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
    setFollowups([]);
  }, []);

  // openDarkroom derives navigation context from live state via refs so it
  // doesn't stale-close over resultImageIds / liveImages.
  const openDarkroom = useCallback((imageId: string) => {
    const currentResultIds = resultImageIdsRef.current;
    const allImages = liveImagesRef.current;
    const contextImages =
      currentResultIds !== null
        ? allImages.filter((img) => currentResultIds.includes(img.id))
        : allImages;
    const index = contextImages.findIndex((img) => img.id === imageId);
    if (index === -1) return;

    const update = () => setDarkroom({ images: contextImages, index });

    // Morph the clicked grid image into the darkroom via View Transitions when supported.
    if ('startViewTransition' in document) {
      document.startViewTransition(update);
    } else {
      update();
    }
  }, []);

  const handleFilterModify = useCallback(
    async (plan: QueryPlan, modifications: FilterMod[]) => {
      if (sending) return;
      setSending(true);
      setProcessing(true);
      setSelectedImageIds([]);
      try {
        const result = await rerunWithModifiedFilters(rollId, plan, modifications);
        setResultImageIds(result.images.map((img) => img.id));
        setActivePlan(result.interpretedFilter);
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

  return {
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
  };
}
