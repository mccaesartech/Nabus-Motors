"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printPrintableDocument } from "@/lib/print/document-shell";
import { cn } from "@/lib/utils";

type CheckoutOrderPrintButtonProps = {
  getHtml: () => string;
  className?: string;
};

export function CheckoutOrderPrintButton({
  getHtml,
  className,
}: CheckoutOrderPrintButtonProps) {
  const [error, setError] = useState<string | null>(null);

  function handlePrint() {
    setError(null);
    try {
      const result = printPrintableDocument(getHtml());
      if (!result.ok) setError(result.error);
    } catch {
      setError("Print failed. Allow popups and try again.");
    }
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="min-h-12 w-full gap-2 sm:w-auto"
        onClick={handlePrint}
      >
        <Printer className="size-4" />
        Print order info
      </Button>
      {error ? (
        <p className="text-center text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
