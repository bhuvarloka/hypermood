"use client";

import { useRef, useState, useEffect } from "react";
import {
  usePositioner,
  useMasonry,
  useScroller,
  useResizeObserver,
  useContainerPosition,
} from "masonic";

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

export function Masonry<T>(props: Props<T>) {
  const [mounted, setMounted] = useState(false);
  // resetKey increments when items shrinks, forcing MasonryInner to remount with a fresh positioner
  const resetKey = useRef(0);
  const prevLen = useRef(props.items.length);

  if (props.items.length < prevLen.current) {
    resetKey.current += 1;
  }
  prevLen.current = props.items.length;

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <MasonryInner key={resetKey.current} {...props} />;
}

function MasonryInner<T>({
  items,
  getKey,
  getAspectRatio,
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
    [width, gap],
  );

  const resizeObserver = useResizeObserver(positioner);

  const columnW = positioner.columnWidth || columnWidth;
  const avgHeight =
    items.length > 0
      ? items.reduce((sum, item) => sum + columnW / (getAspectRatio(item) || 1), 0) /
        items.length
      : 300;

  const grid = useMasonry({
    positioner,
    resizeObserver,
    items,
    height: window.innerHeight,
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
