"use client";

import { useRef } from "react";
import {
  usePositioner,
  useMasonry,
  useScroller,
  useResizeObserver,
  useContainerPosition,
} from "masonic";

const ensureResizeObserver = () => {
  if (typeof globalThis.ResizeObserver !== "undefined") {
    return;
  }

  class FallbackResizeObserver implements ResizeObserver {
    constructor(_callback: ResizeObserverCallback) {}
    observe(_target: Element) {}
    unobserve(_target: Element) {}
    disconnect() {}
  }

  // Fallback for SSR or runtimes without ResizeObserver support.
  globalThis.ResizeObserver = FallbackResizeObserver;
};

ensureResizeObserver();

export type MasonryRenderProps<T> = {
  index: number;
  width: number;
  data: T;
};

type Props<T> = {
  items: T[];
  getKey: (item: T) => string | number;
  getAspectRatio: (item: T) => number;
  renderItem: React.ComponentType<MasonryRenderProps<T>>;
  columnWidth?: number;
  maxColumnCount?: number;
  gap?: number;
  className?: string;
};

export function Masonry<T>({
  items,
  getKey,
  getAspectRatio: _getAspectRatio,
  renderItem,
  columnWidth = 240,
  maxColumnCount,
  gap = 4,
  className,
}: Props<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { offset, width } = useContainerPosition(containerRef, []);
  const { scrollTop, isScrolling } = useScroller(offset);

  const positioner = usePositioner(
    { width, columnWidth, columnGutter: gap, maxColumnCount },
    [width, gap, items.length],
  );

  const resizeObserver = useResizeObserver(positioner);

  // Estimated height based on aspect ratio for the column width
  const columnW = positioner.columnWidth || columnWidth;
  const avgHeight =
    items.length > 0
      ? items.reduce(
          (sum, item) => sum + columnW / (_getAspectRatio(item) || 1),
          0,
        ) / items.length
      : 300;

  const grid = useMasonry({
    positioner,
    resizeObserver,
    items,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
    scrollTop,
    isScrolling,
    overscanBy: 2,
    itemKey: getKey as (data: T, index: number) => string | number,
    itemHeightEstimate: avgHeight,
    render: renderItem,
    containerRef,
  });

  return (
    <div ref={containerRef} className={className}>
      {grid}
    </div>
  );
}
