"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

const DEFAULT_ROW_HEIGHT = 56;
const DEFAULT_OVERSCAN = 6;
const VIRTUALIZE_THRESHOLD = 40;

type VirtualTableBodyProps<T> = {
  items: T[];
  colSpan: number;
  rowHeight?: number;
  overscan?: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  getKey: (item: T, index: number) => string;
  renderRow: (item: T, index: number) => ReactNode;
  emptyRow?: ReactNode;
};

function useVirtualRange(
  scrollRef: RefObject<HTMLDivElement | null>,
  itemCount: number,
  rowHeight: number,
  overscan: number,
  enabled: boolean
) {
  const [range, setRange] = useState({ start: 0, end: Math.min(itemCount, 20) });

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !enabled || itemCount === 0) {
      setRange({ start: 0, end: itemCount });
      return;
    }

    const scrollTop = el.scrollTop;
    const viewportHeight = el.clientHeight;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
    const end = Math.min(itemCount, start + visibleCount);
    setRange((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end }
    );
  }, [scrollRef, itemCount, rowHeight, overscan, enabled]);

  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [scrollRef, update]);

  return range;
}

export function VirtualTableBody<T>({
  items,
  colSpan,
  rowHeight = DEFAULT_ROW_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
  scrollRef,
  getKey,
  renderRow,
  emptyRow,
}: VirtualTableBodyProps<T>) {
  const enabled = items.length >= VIRTUALIZE_THRESHOLD;
  const { start, end } = useVirtualRange(
    scrollRef,
    items.length,
    rowHeight,
    overscan,
    enabled
  );

  if (items.length === 0) {
    return <tbody>{emptyRow}</tbody>;
  }

  if (!enabled) {
    return (
      <tbody>
        {items.map((item, index) => (
          <FragmentRow key={getKey(item, index)}>{renderRow(item, index)}</FragmentRow>
        ))}
      </tbody>
    );
  }

  const paddingTop = start * rowHeight;
  const paddingBottom = Math.max(0, (items.length - end) * rowHeight);
  const visible = items.slice(start, end);

  return (
    <tbody>
      {paddingTop > 0 ? (
        <tr aria-hidden>
          <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 0 }} />
        </tr>
      ) : null}
      {visible.map((item, index) => {
        const absoluteIndex = start + index;
        return (
          <FragmentRow key={getKey(item, absoluteIndex)}>
            {renderRow(item, absoluteIndex)}
          </FragmentRow>
        );
      })}
      {paddingBottom > 0 ? (
        <tr aria-hidden>
          <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 0 }} />
        </tr>
      ) : null}
    </tbody>
  );
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Scrollable table wrapper with ref for virtualized tbody. */
export function VirtualTableScroll({
  children,
  className,
}: {
  children: (scrollRef: RefObject<HTMLDivElement | null>) => ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={scrollRef} className={className}>
      {children(scrollRef)}
    </div>
  );
}
