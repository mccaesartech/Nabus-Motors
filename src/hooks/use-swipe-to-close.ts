"use client";

import { useCallback, useRef } from "react";

type SwipeToCloseOptions = {
  enabled: boolean;
  onClose: () => void;
  direction?: "left" | "right";
  threshold?: number;
};

export function useSwipeToClose({
  enabled,
  onClose,
  direction = "left",
  threshold = 56,
}: SwipeToCloseOptions) {
  const startX = useRef<number | null>(null);

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled) return;
      startX.current = event.touches[0]?.clientX ?? null;
    },
    [enabled]
  );

  const onTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled || startX.current === null) return;

      const currentX = event.touches[0]?.clientX;
      if (currentX == null) return;

      const delta = currentX - startX.current;
      const shouldClose =
        direction === "left" ? delta < -threshold : delta > threshold;

      if (shouldClose) {
        startX.current = null;
        onClose();
      }
    },
    [direction, enabled, onClose, threshold]
  );

  const onTouchEnd = useCallback(() => {
    startX.current = null;
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd };
}

type SwipeHandlers = {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
  onTouchEnd: (event: React.TouchEvent) => void;
};

export function mergeSwipeHandlers(...handlers: SwipeHandlers[]): SwipeHandlers {
  return {
    onTouchStart: (event) => {
      for (const handler of handlers) {
        handler.onTouchStart(event);
      }
    },
    onTouchMove: (event) => {
      for (const handler of handlers) {
        handler.onTouchMove(event);
      }
    },
    onTouchEnd: (event) => {
      for (const handler of handlers) {
        handler.onTouchEnd(event);
      }
    },
  };
}
