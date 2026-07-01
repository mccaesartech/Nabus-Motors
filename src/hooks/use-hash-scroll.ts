"use client";

import { useEffect } from "react";
import { scrollToElement } from "@/lib/scroll-to-element";

export function useHashScroll(...deps: unknown[]) {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    requestAnimationFrame(() => scrollToElement(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit deps from caller
  }, deps);
}
