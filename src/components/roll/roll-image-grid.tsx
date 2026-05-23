"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getImageUrl, getLqipUrl } from "@/lib/imagekit/url";
import type { Image as ImageRecord } from "@/types/domain";
import { Masonry, type MasonryRenderProps } from "@/components/ui/masonry";
import { useState } from "react";

type Props = {
  rollId: string;
  initialImages: ImageRecord[];
  resultImageIds?: string[] | null;
  selectedImageIds?: string[];
  onImageClick?: (id: string, isModified: boolean) => void;
  onImagesChange?: (images: ImageRecord[]) => void;
};

type CellData = {
  image: ImageRecord;
  isSelected: boolean;
  onImageClick?: (id: string, isModified: boolean) => void;
};

function ImageCell({ data }: MasonryRenderProps<CellData>) {
  const { image, isSelected, onImageClick } = data;
  const src = getImageUrl(image.storage_key, { width: 400, quality: 80 });
  const lqip = getLqipUrl(image.storage_key);

  const w = image.width ?? 400;
  const h = image.height ?? 300;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={(e) => onImageClick?.(image.id, e.metaKey || e.ctrlKey || e.shiftKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onImageClick?.(image.id, false);
        }
      }}
      className="group relative rounded-none focus:outline-none focus:ring-2 focus:ring-primary-900 cursor-pointer"
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
        // Named so it can morph into the darkroom via View Transitions.
        style={{ viewTransitionName: `image-${image.id}` }}
      />

      {/* Selection dot — top-left, replaces hover chrome */}
      <div
        className={`absolute top-2 left-2 w-3 h-3 rounded-full border-2 border-white transition-opacity ${
          isSelected ? "opacity-100 bg-semantic-info" : "opacity-0 group-hover:opacity-60 bg-transparent"
        }`}
        aria-hidden="true"
      />
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
