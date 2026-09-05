"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type NabusSearchBarProps = {
  compact?: boolean;
  className?: string;
  placeholder?: string;
};

export function NabusSearchBar({
  compact = false,
  className,
  placeholder = "Search make, model, year…",
}: NabusSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      router.push(ROUTES.auto.inventory);
      return;
    }
    router.push(`${ROUTES.auto.inventory}?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("relative", compact ? "w-[180px]" : "w-full", className)}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--nabus-text-secondary)]" />
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-10 rounded-lg border-[var(--nabus-input-border)] bg-[var(--nabus-background)] pl-9 text-sm focus-visible:border-[var(--nabus-primary)] focus-visible:ring-[var(--nabus-primary)]/20",
          compact && "h-9 text-xs"
        )}
        aria-label="Search vehicles"
      />
    </form>
  );
}
