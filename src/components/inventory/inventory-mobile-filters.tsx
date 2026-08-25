"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { InventoryFilters } from "@/components/inventory/inventory-filters";

export function InventoryMobileFilters() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="min-h-11 lg:hidden">
            <SlidersHorizontal className="size-4" />
            Filters
          </Button>
        }
      />
      <SheetContent side="left" className="w-[min(100dvw-2rem,20rem)] overflow-y-auto p-0 sm:max-w-xs">
        <SheetHeader className="border-b border-border px-4 py-4">
          <SheetTitle>Filter inventory</SheetTitle>
        </SheetHeader>
        <div className="px-4 py-4">
          <InventoryFilters onApplied={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
