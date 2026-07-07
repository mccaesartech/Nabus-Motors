"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  downloadPrintableDocument,
  getCachedPrintablePdf,
  isPrintablePdfGenerating,
  preloadPdfEngine,
  prewarmPrintablePdf,
  type PrintableDocumentResult,
} from "@/lib/print/document-shell";

const PDF_TIMEOUT_MS = 15_000;

type UsePrintablePdfOptions = {
  /** Prewarm PDF as soon as the component mounts (default: true). */
  autoPrewarm?: boolean;
};

export function usePrintablePdf(
  getHtml: () => string,
  downloadFilename: string,
  options: UsePrintablePdfOptions = {}
) {
  const { autoPrewarm = true } = options;
  const getHtmlRef = useRef(getHtml);
  getHtmlRef.current = getHtml;

  const [generating, setGenerating] = useState(false);
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const downloadQueueRef = useRef<Promise<PrintableDocumentResult> | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearTimeoutTimer = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const syncReady = useCallback(() => {
    const html = getHtmlRef.current();
    const cached = getCachedPrintablePdf(html) != null;
    const inFlight = isPrintablePdfGenerating(html);
    setReady(cached);
    setGenerating(inFlight);
    if (cached) {
      setTimedOut(false);
      clearTimeoutTimer();
    }
  }, [clearTimeoutTimer]);

  const startTimeout = useCallback(() => {
    clearTimeoutTimer();
    timeoutRef.current = window.setTimeout(() => {
      const html = getHtmlRef.current();
      if (!getCachedPrintablePdf(html)) {
        setTimedOut(true);
      }
    }, PDF_TIMEOUT_MS);
  }, [clearTimeoutTimer]);

  const prewarm = useCallback(() => {
    const html = getHtmlRef.current();
    if (getCachedPrintablePdf(html)) {
      setReady(true);
      setGenerating(false);
      setTimedOut(false);
      return;
    }
    if (isPrintablePdfGenerating(html)) {
      setGenerating(true);
      startTimeout();
      return;
    }
    setGenerating(true);
    setTimedOut(false);
    startTimeout();
    void prewarmPrintablePdf(html).finally(() => {
      syncReady();
    });
  }, [startTimeout, syncReady]);

  useEffect(() => {
    preloadPdfEngine();
    if (autoPrewarm) {
      prewarm();
    }
  }, [autoPrewarm, prewarm]);

  useEffect(() => {
    if (!generating || ready) return;
    const id = window.setInterval(syncReady, 200);
    return () => window.clearInterval(id);
  }, [generating, ready, syncReady]);

  useEffect(() => clearTimeoutTimer, [clearTimeoutTimer]);

  const download = useCallback(async (): Promise<PrintableDocumentResult> => {
    const html = getHtmlRef.current();

    if (getCachedPrintablePdf(html)) {
      setReady(true);
      setGenerating(false);
      setTimedOut(false);
      return downloadPrintableDocument(html, downloadFilename);
    }

    if (downloadQueueRef.current) {
      return downloadQueueRef.current;
    }

    setGenerating(true);
    setTimedOut(false);
    startTimeout();

    const promise = downloadPrintableDocument(html, downloadFilename).finally(() => {
      downloadQueueRef.current = null;
      syncReady();
      setGenerating(false);
    });

    downloadQueueRef.current = promise;
    return promise;
  }, [downloadFilename, startTimeout, syncReady]);

  return {
    generating,
    ready,
    timedOut,
    prewarm,
    download,
    downloadLabel: ready
      ? "Download PDF"
      : generating
        ? "Preparing PDF…"
        : "Download PDF",
  };
}
