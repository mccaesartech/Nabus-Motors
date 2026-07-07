"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printPrintableDocument } from "@/lib/print/document-shell";
import { cn } from "@/lib/utils";

type OrderPrintActionsProps = {
  getHtml: () => string;
  printLabel?: string;
  className?: string;
};

export function OrderPrintActions({
  getHtml,
  printLabel = "Print",
  className,
}: OrderPrintActionsProps) {
  const [actionError, setActionError] = useState<string | null>(null);

  function handlePrint() {
    setActionError(null);
    try {
      const result = printPrintableDocument(getHtml());
      if (!result.ok) setActionError(result.error);
    } catch {
      setActionError("Print failed. Allow popups and try again.");
    }
  }

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-10 gap-1.5"
        onClick={handlePrint}
      >
        <Printer className="size-3.5" />
        {printLabel}
      </Button>
      {actionError ? (
        <p className="text-xs text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
