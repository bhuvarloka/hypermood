"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getImageUrl, getLqipUrl } from "@/lib/imagekit/url";
import { deleteImages } from "@/actions/images";
import type { Image as ImageRecord } from "@/types/domain";
import { Masonry, type MasonryRenderProps } from "@/components/ui/masonry";
import { useState } from "react";

type Props = {
  rollId: string;
  initialImages: ImageRecord[];
  resultImageIds?: string[] | null;
  selectedImageIds?: string[];
  onImageClick?: (id: string) => void;
  onImagesChange?: (images: ImageRecord[]) => void;
  onFullscreen?: (imageId: string, contextImages: ImageRecord[]) => void;
};

type CellData = {
  image: ImageRecord;
  isSelected: boolean;
  onImageClick?: (id: string) => void;
  onFullscreen?: () => void;
  onDelete?: (id: string) => void;
};

function ImageCell({ data }: MasonryRenderProps<CellData>) {
  const { image, isSelected, onImageClick, onFullscreen, onDelete } = data;
  const src = getImageUrl(image.storage_key, { width: 400, quality: 80 });
  const lqip = getLqipUrl(image.storage_key);

  const w = image.width ?? 400;
  const h = image.height ?? 300;

  const ringClass = isSelected ? "ring-2 ring-semantic-info ring-offset-2" : "";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => onImageClick?.(image.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onImageClick?.(image.id);
        }
      }}
      className={`group relative rounded-none focus:outline-none focus:ring-2 focus:ring-primary-900 cursor-pointer ${ringClass}`}
    >
      <Image
        src={src}
        alt={image.original_filename ?? ""}
        width={w}
        height={h}
        sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className="w-full h-auto rounded-none block"
        placeholder="blur"
        blurDataURL={lqip}
      />

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 animate-bloom flex gap-1">
        {onFullscreen && (
          <button
            onClick={(e) => { e.stopPropagation(); onFullscreen(); }}
            className="flex items-center justify-center w-7 h-7 bg-black/40 hover:bg-black/60 animate-swiss"
            aria-label="Open fullscreen"
            tabIndex={-1}
          >
            <span className="text-white text-base leading-none">⤢</span>
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(image.id); }}
            className="flex items-center justify-center w-7 h-7 bg-black/40 hover:bg-semantic-alert/80 animate-swiss"
            aria-label="Delete image"
            tabIndex={-1}
          >
            <span className="text-white text-base leading-none">×</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function RollImageGrid({
  rollId,
  initialImages,
  resultImageIds = null,
  selectedImageIds = [],
  onImageClick,
  onImagesChange,
  onFullscreen,
}: Props) {
  const [images, setImages] = useState<ImageRecord[]>(initialImages);
  const bufferRef = useRef<ImageRecord[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const onImagesChangeRef = useRef(onImagesChange);
  onImagesChangeRef.current = onImagesChange;

  // Notify parent after images state settles — never during a render
  useEffect(() => {
    onImagesChangeRef.current?.(images);
  }, [images]);

  useEffect(() => {
    const supabase = createClient();

    const handleChange = (payload: { new: unknown }) => {
      const upserted = payload.new as ImageRecord;
      bufferRef.current.push(upserted);

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          const buffered = bufferRef.current.splice(0);
          rafIdRef.current = null;

          setImages((prev) => {
            const map = new Map(prev.map((img) => [img.id, img]));
            for (const img of buffered) map.set(img.id, img);
            return Array.from(map.values());
          });
        });
      }
    };

    const channel = supabase
      .channel(`roll-images-${rollId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "images",
          filter: `roll_id=eq.${rollId}`,
        },
        handleChange,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "images",
          filter: `roll_id=eq.${rollId}`,
        },
        handleChange,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
        bufferRef.current.splice(0);
      }
    };
  }, [rollId]);

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 py-20">
        <p className="text-2xl font-medium text-primary-200">
          No images yet. Drag files here to index.
        </p>
      </div>
    );
  }

  const resultSet = resultImageIds !== null ? new Set(resultImageIds) : null;
  const selectedSet = new Set(selectedImageIds);

  // Context-aware navigation: Darkroom navigates within the active result set (or all images).
  const contextImages =
    resultSet !== null ? images.filter((img) => resultSet.has(img.id)) : images;

  function handleDelete(id: string) {
    // Optimistic: remove from local state immediately
    setImages((prev) => prev.filter((img) => img.id !== id));
    deleteImages([id]).catch(() => {
      console.error("Failed to delete image", id);
    });
  }

  // T-04: reflow on filter rather than dim non-matching cells.
  // Dense reflow (default): non-matching cells are dropped from the grid so
  // masonic repacks remaining cells into the available columns. Selected cells
  // are kept visible across filter changes so the user's working set is never
  // hidden by a query.
  const visibleImages =
    resultSet !== null
      ? images.filter((img) => resultSet.has(img.id) || selectedSet.has(img.id))
      : images;

  const cellItems: CellData[] = visibleImages.map((image) => ({
    image,
    isSelected: selectedSet.has(image.id),
    onImageClick,
    onFullscreen: onFullscreen
      ? () => onFullscreen(image.id, contextImages)
      : undefined,
    onDelete: handleDelete,
  }));

  return (
    <Masonry
      items={cellItems}
      getKey={(item) => item?.image?.id ?? ""}
      getAspectRatio={(item) => {
        const w = item?.image?.width ?? 1;
        const h = item?.image?.height ?? 1;
        return w / h;
      }}
      renderItem={ImageCell}
      columnWidth={240}
      gap={4}
      className="p-4"
    />
  );
}
