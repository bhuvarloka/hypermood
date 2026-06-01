"use client";

import {
  useEffect,
  useCallback,
  useState,
  useOptimistic,
  useTransition,
} from "react";
import Image from "next/image";
import {
  listGalleriesWithImageData,
  getGalleryImages,
  updateGallery,
  removeImagesFromGallery,
  reorderGalleryImages,
} from "@/actions/galleries";
import { getImageUrl } from "@/lib/imagekit/url";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import type {
  Gallery,
  GalleryLayout,
  GalleryListItem,
  Image as ImageRecord,
} from "@/types/domain";

type View =
  | { kind: "list" }
  | { kind: "detail"; gallery: GalleryListItem; images: ImageRecord[] };

type Props = {
  onClose: () => void;
  // If provided, only shows galleries for this roll
  rollId?: string;
  // If provided, opens directly to this gallery's detail view
  initialGalleryId?: string;
};

export function GalleryDrawer({ onClose, rollId, initialGalleryId }: Props) {
  const [galleries, setGalleries] = useState<GalleryListItem[]>([]);
  const [view, setView] = useState<View>({ kind: "list" });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    listGalleriesWithImageData(rollId)
      .then(setGalleries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [rollId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const openDetail = useCallback(async (gallery: GalleryListItem) => {
    const images = await getGalleryImages(gallery.id);
    setView({ kind: "detail", gallery, images });
  }, []);

  // Once galleries load, auto-open the initial gallery if specified
  useEffect(() => {
    if (!initialGalleryId || galleries.length === 0) return;
    const target = galleries.find((g) => g.id === initialGalleryId);
    if (target) openDetail(target);
    // only trigger once on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleries]);

  const handleUpdated = useCallback((updated: Gallery) => {
    setGalleries((prev) =>
      prev.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)),
    );
    setView((v) =>
      v.kind === "detail" && v.gallery.id === updated.id
        ? { ...v, gallery: { ...v.gallery, ...updated } }
        : v,
    );
  }, []);

  const handleImagesChanged = useCallback(
    (galleryId: string, images: ImageRecord[]) => {
      setGalleries((prev) =>
        prev.map((g) =>
          g.id === galleryId ? { ...g, image_count: images.length } : g,
        ),
      );
      setView((v) =>
        v.kind === "detail" && v.gallery.id === galleryId
          ? { ...v, images }
          : v,
      );
    },
    [],
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-primary-950/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-96 bg-white animate-bloom overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 shrink-0">
          {view.kind === "detail" ? (
            <button
              onClick={() => setView({ kind: "list" })}
              className="text-sm text-primary-400 animate-swiss hover:text-primary-900"
            >
              ← back
            </button>
          ) : (
            <span className="text-lg font-medium">Galleries</span>
          )}
          <button
            onClick={onClose}
            className="text-primary-200 animate-swiss hover:text-primary-900"
            aria-label="Close galleries"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-primary-400 px-6">Loading…</p>
          ) : view.kind === "list" ? (
            <GalleryList
              galleries={galleries}
              onOpen={openDetail}
              onUpdated={handleUpdated}
            />
          ) : (
            <GalleryDetail
              gallery={view.gallery}
              images={view.images}
              onUpdated={handleUpdated}
              onImagesChanged={handleImagesChanged}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Gallery list
// ---------------------------------------------------------------------------

function GalleryList({
  galleries,
  onOpen,
  onUpdated,
}: {
  galleries: GalleryListItem[];
  onOpen: (g: GalleryListItem) => void;
  onUpdated: (g: Gallery) => void;
}) {
  if (galleries.length === 0) {
    return <p className="text-sm text-primary-400 px-6">No galleries yet.</p>;
  }

  return (
    <ul>
      {galleries.map((g) => (
        <GalleryRow
          key={g.id}
          gallery={g}
          onOpen={onOpen}
          onUpdated={onUpdated}
        />
      ))}
    </ul>
  );
}

function GalleryRow({
  gallery,
  onOpen,
  onUpdated,
}: {
  gallery: GalleryListItem;
  onOpen: (g: GalleryListItem) => void;
  onUpdated: (g: Gallery) => void;
}) {
  const [saving, startSave] = useTransition();

  const togglePublic = useCallback(() => {
    startSave(async () => {
      const updated = await updateGallery(gallery.id, {
        is_public: !gallery.is_public,
      });
      onUpdated(updated);
    });
  }, [gallery.id, gallery.is_public, onUpdated]);

  return (
    <li>
      <div className="group w-full flex items-center gap-4 px-6 py-3 hover:bg-primary-50">
        <button
          onClick={() => onOpen(gallery)}
          className="flex items-center gap-4 min-w-0 flex-1 text-left animate-swiss"
        >
          {/* 2×2 thumbnail mosaic */}
          <div className="grid grid-cols-2 gap-px w-12 h-12 shrink-0 bg-primary-100">
            {Array.from({ length: 4 }, (_, i) => {
              const key = gallery.thumbnail_keys[i];
              return key ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={getImageUrl(key, { width: 24, height: 24, quality: 60 })}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div key={i} className="bg-primary-100" />
              );
            })}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-lg truncate">{gallery.name}</p>
            <p className="text-sm tabular-nums text-primary-400">
              {gallery.image_count}{" "}
              {gallery.image_count === 1 ? "image" : "images"}
            </p>
          </div>

          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className="shrink-0 text-primary-200"
          >
            <path
              d="M4 2l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={togglePublic}
            disabled={saving}
            className={`text-sm px-2.5 py-1 border animate-swiss shrink-0 ${
              gallery.is_public
                ? "border-semantic-info text-semantic-info hover:bg-primary-50"
                : "border-primary-200 text-primary-200 hover:text-primary-900 hover:border-primary-900"
            } disabled:opacity-50`}
          >
            {gallery.is_public ? "public" : "private"}
          </button>

          {gallery.is_public && (
            <CopyLinkButton
              url={`/g/${gallery.slug}`}
              ariaLabel="Copy public link"
              className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
            />
          )}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Gallery detail
// ---------------------------------------------------------------------------

function GalleryDetail({
  gallery,
  images,
  onUpdated,
  onImagesChanged,
}: {
  gallery: GalleryListItem;
  images: ImageRecord[];
  onUpdated: (g: Gallery) => void;
  onImagesChanged: (galleryId: string, images: ImageRecord[]) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(gallery.name);
  const [saving, startSave] = useTransition();
  const [optimisticImages, setOptimisticImages] = useOptimistic(images);

  const handleNameBlur = useCallback(() => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === gallery.name) {
      setEditingName(false);
      return;
    }
    startSave(async () => {
      const updated = await updateGallery(gallery.id, { name: trimmed });
      onUpdated(updated);
      setEditingName(false);
    });
  }, [nameInput, gallery.id, gallery.name, onUpdated]);

  const setLayout = useCallback(
    (layout: GalleryLayout) => {
      if (layout === gallery.layout) return;
      startSave(async () => {
        const updated = await updateGallery(gallery.id, { layout });
        onUpdated(updated);
      });
    },
    [gallery.id, gallery.layout, onUpdated],
  );

  const removeImage = useCallback(
    (imageId: string) => {
      const next = optimisticImages.filter((img) => img.id !== imageId);
      startSave(async () => {
        setOptimisticImages(next);
        await removeImagesFromGallery(gallery.id, [imageId]);
        onImagesChanged(gallery.id, next);
      });
    },
    [gallery.id, optimisticImages, setOptimisticImages, onImagesChanged],
  );

  // Drag-to-reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((i: number) => setDragIndex(i), []);
  const handleDragOver = useCallback((e: React.DragEvent, i: number) => {
    e.preventDefault();
    setDragOverIndex(i);
  }, []);

  const handleDrop = useCallback(
    (dropIndex: number) => {
      if (dragIndex === null || dragIndex === dropIndex) {
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }
      const next = [...optimisticImages];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      setDragIndex(null);
      setDragOverIndex(null);
      startSave(async () => {
        setOptimisticImages(next);
        await reorderGalleryImages(
          gallery.id,
          next.map((img) => img.id),
        );
        onImagesChanged(gallery.id, next);
      });
    },
    [
      dragIndex,
      optimisticImages,
      setOptimisticImages,
      gallery.id,
      onImagesChanged,
    ],
  );

  return (
    <div className="flex flex-col gap-6 px-6 pb-8">
      {/* Name */}
      <div>
        {editingName ? (
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameBlur();
            }}
            disabled={saving}
            className="text-xl font-medium w-full outline-none border-b border-primary-900 pb-1 bg-transparent"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-xl font-medium text-left animate-swiss hover:opacity-70"
          >
            {gallery.name}
          </button>
        )}
        <p className="text-sm tabular-nums text-primary-400 mt-1">
          {images.length} {images.length === 1 ? "image" : "images"}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Layout toggle */}
        <div className="flex border border-primary-200 text-sm">
          {(["masonry", "timeline"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              disabled={saving}
              className={`px-3 py-1 animate-swiss ${
                gallery.layout === l
                  ? "bg-primary-900 text-white"
                  : "hover:bg-primary-50"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <span
          className={`text-sm px-3 py-1 border ${
            gallery.is_public
              ? "border-semantic-info text-semantic-info"
              : "border-primary-200 text-primary-200"
          }`}
        >
          {gallery.is_public ? "public" : "private"}
        </span>

        {/* Public link + copy */}
        {gallery.is_public && (
          <div className="flex items-center gap-2 min-w-0">
            <a
              href={`/g/${gallery.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm tabular-nums text-semantic-info animate-swiss hover:opacity-70 truncate"
            >
              /g/{gallery.slug}
            </a>
            <CopyLinkButton url={`/g/${gallery.slug}`} ariaLabel="Copy public link" />
          </div>
        )}
      </div>

      {/* Image grid — drag-to-reorder, × to remove */}
      {optimisticImages.length > 0 ? (
        <div className="grid grid-cols-3 gap-1">
          {optimisticImages.map((img, i) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => {
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              className={`relative group cursor-grab active:cursor-grabbing ${
                dragOverIndex === i && dragIndex !== i
                  ? "ring-2 ring-primary-900 ring-inset"
                  : ""
              }`}
            >
              <Image
                src={getImageUrl(img.storage_key, {
                  width: 120,
                  height: 120,
                  quality: 70,
                })}
                alt={img.original_filename ?? ""}
                width={120}
                height={120}
                className="w-full aspect-square object-cover"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-primary-950/70 text-white text-xs opacity-0 group-hover:opacity-100 animate-swiss"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-primary-400">No images in this gallery.</p>
      )}
    </div>
  );
}
