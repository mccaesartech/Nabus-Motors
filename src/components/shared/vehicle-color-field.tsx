"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  colorLabelForImageUrl,
  filterVehicleColorOptions,
  findVehicleColorOption,
  groupedVehicleColorOptions,
  swatchEdgeClass,
} from "@/lib/vehicles/vehicle-colors";
import { VehicleColorSwatch } from "@/components/shared/vehicle-color-swatch";

type VehicleColorFieldProps = {
  value: string;
  onChange: (value: string) => void;
  primaryImageUrl?: string | null;
  className?: string;
  selectClassName?: string;
  inputClassName?: string;
};

export function VehicleColorField({
  value,
  onChange,
  primaryImageUrl,
  className = "",
  selectClassName = "",
  inputClassName = "",
}: VehicleColorFieldProps) {
  const suggested = colorLabelForImageUrl(primaryImageUrl ?? undefined);
  const matchedOption = findVehicleColorOption(value);
  // Keep the custom input visible even while its text is empty; deriving
  // "custom" purely from `value` hides the input as soon as it is cleared.
  const [customMode, setCustomMode] = useState(
    () => Boolean(value.trim()) && !matchedOption,
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const searchId = useId();

  const colorGroups = groupedVehicleColorOptions(filterVehicleColorOptions(search));

  useEffect(() => {
    const known = findVehicleColorOption(value);
    if (known) {
      setCustomMode(false);
    } else if (value.trim()) {
      setCustomMode(true);
    }
  }, [value]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    const focusTimer = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 0);
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const showCustomInput = customMode || (!matchedOption && Boolean(value.trim()));
  const displayLabel = customMode
    ? value.trim()
      ? value
      : "Custom…"
    : matchedOption?.label ?? (value.trim() ? value : "Select color…");
  const displaySwatchColor =
    matchedOption?.label ?? (customMode ? "" : value || suggested || "");

  function selectKnown(label: string) {
    setCustomMode(false);
    setOpen(false);
    onChange(label);
  }

  function selectCustom() {
    setCustomMode(true);
    setOpen(false);
    // Clear known palette picks so the free-text field starts empty;
    // keep an existing custom string so edits are not lost.
    onChange(matchedOption ? "" : value);
  }

  return (
    <div ref={rootRef} className={`relative space-y-2 ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Exterior color"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full min-w-0 items-center gap-2 text-left ${selectClassName}`}
      >
        <VehicleColorSwatch
          color={displaySwatchColor}
          hex={matchedOption?.hex}
          size="md"
        />
        <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
        <span aria-hidden className="shrink-0 text-xs opacity-60">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-black/15 bg-white shadow-lg">
          <div className="border-b border-neutral-200 p-2">
            <label htmlFor={searchId} className="sr-only">
              Search colors
            </label>
            <input
              ref={searchRef}
              id={searchId}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                // Keep typing in the search box from closing the listbox.
                e.stopPropagation();
              }}
              placeholder="Search colors…"
              autoComplete="off"
              className="w-full rounded border border-black/10 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-black/25"
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-label="Exterior color options"
            className="max-h-64 overflow-y-auto py-1"
          >
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={!value.trim() && !customMode}
                onClick={() => {
                  setCustomMode(false);
                  setOpen(false);
                  onChange("");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-100"
              >
                Select color…
              </button>
            </li>
            {colorGroups.map(({ group, options }) => (
              <li key={group} role="presentation">
                <div
                  className="sticky top-0 z-10 bg-neutral-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
                  aria-hidden
                >
                  {group}
                </div>
                <ul role="group" aria-label={group}>
                  {options.map((opt) => {
                    const selected = !customMode && matchedOption?.label === opt.label;
                    return (
                      <li key={opt.label} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => selectKnown(opt.label)}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-neutral-900 hover:bg-neutral-100 ${
                            selected ? "bg-neutral-100 font-medium" : ""
                          }`}
                        >
                          <span
                            className={`inline-block size-5 shrink-0 rounded-full border ${swatchEdgeClass(opt.hex)} shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]`}
                            style={{ backgroundColor: opt.hex }}
                            title={opt.label}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            {colorGroups.length === 0 && (
              <li
                role="presentation"
                className="px-3 py-2 text-sm text-neutral-500"
              >
                No colors match “{search.trim()}”
              </li>
            )}
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={customMode}
                onClick={selectCustom}
                className={`flex w-full items-center gap-2.5 border-t border-neutral-200 px-3 py-2 text-left text-sm text-neutral-900 hover:bg-neutral-100 ${
                  customMode ? "bg-neutral-100 font-medium" : ""
                }`}
              >
                <span
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-neutral-400 text-[10px] leading-none"
                  aria-hidden
                >
                  +
                </span>
                <span>Custom…</span>
              </button>
            </li>
          </ul>
        </div>
      )}

      {showCustomInput && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
          placeholder="e.g. Alpine White, Sonic Grey Pearl"
          aria-label="Custom exterior color"
        />
      )}

      {suggested && suggested !== value && (
        <button
          type="button"
          onClick={() => {
            const known = findVehicleColorOption(suggested);
            setCustomMode(!known);
            onChange(known?.label ?? suggested);
          }}
          className="text-left text-xs text-[var(--platform-accent,#7c3aed)] underline-offset-2 hover:underline"
        >
          Match primary photo: {suggested}
        </button>
      )}
    </div>
  );
}
