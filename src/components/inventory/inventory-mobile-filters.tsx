"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NabusFilterDrawer } from "@/components/nabus/nabus-filter-drawer";
import { InventoryFilters } from "@/components/inventory/inventory-filters";

export function InventoryMobileFilters() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 gap-2 rounded-lg border-[var(--nabus-input-border)] lg:hidden"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="size-4" />
        Filters
      </Button>
      <NabusFilterDrawer open={open} onClose={() => setOpen(false)} title="Filter inventory">
        <InventoryFilters onApplied={() => setOpen(false)} />
      </NabusFilterDrawer>
    </>
  );
}
