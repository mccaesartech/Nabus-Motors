"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Code2,
  GripVertical,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  DEFAULT_CARGO_TYPES,
  parseCargoOptions,
  serializeCargoOptions,
  slugifyCargoValue,
  type CargoSizeOption,
  type CargoTypeOption,
} from "@/lib/freight/cargo-options";

type CargoOptionsEditorProps = {
  value: string;
  onChange: (json: string) => void;
};

function newCargoType(existing: CargoTypeOption[]): CargoTypeOption {
  const base = "New cargo type";
  let value = slugifyCargoValue(base);
  let n = 2;
  const used = new Set(existing.map((o) => o.value));
  while (used.has(value)) {
    value = `${slugifyCargoValue(base)}_${n}`;
    n += 1;
  }
  return {
    value,
    label: base,
    sizeLabel: "Size",
    sizes: [{ value: "small", label: "Small" }],
  };
}

function newSizeOption(existing: CargoSizeOption[]): CargoSizeOption {
  const base = "Option";
  let value = slugifyCargoValue(base);
  let n = 2;
  const used = new Set(existing.map((s) => s.value));
  while (used.has(value)) {
    value = `${slugifyCargoValue(base)}_${n}`;
    n += 1;
  }
  return { value, label: base };
}

function cargoTypeSummary(option: CargoTypeOption): string {
  if (option.custom) return "Customer describes their own cargo";
  if (option.value === "documents" || !option.sizes?.length) return "No size selection";
  const count = option.sizes.length;
  return `${count} size option${count === 1 ? "" : "s"}`;
}

export function CargoOptionsEditor({ value, onChange }: CargoOptionsEditorProps) {
  const baseId = useId();
  const [expanded, setExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState<CargoTypeOption[]>(() => parseCargoOptions(value));
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOptions(parseCargoOptions(value));
  }, [value]);

  const commit = useCallback(
    (next: CargoTypeOption[]) => {
      setOptions(next);
      onChange(serializeCargoOptions(next));
    },
    [onChange]
  );

  const summary = useMemo(
    () =>
      options.length === 0
        ? "No cargo types configured"
        : `${options.length} cargo type${options.length === 1 ? "" : "s"}: ${options.map((o) => o.label).join(", ")}`,
    [options]
  );

  function updateType(index: number, patch: Partial<CargoTypeOption>) {
    const next = options.map((opt, i) => {
      if (i !== index) return opt;
      const merged = { ...opt, ...patch };
      if (patch.label !== undefined && patch.value === undefined) {
        const slug = slugifyCargoValue(patch.label);
        if (slug && !options.some((o, j) => j !== index && o.value === slug)) {
          merged.value = slug;
        }
      }
      return merged;
    });
    commit(next);
  }

  function removeType(index: number) {
    if (!window.confirm(`Remove "${options[index]?.label}" from the quote form?`)) return;
    commit(options.filter((_, i) => i !== index));
  }

  function addType() {
    const next = [...options, newCargoType(options)];
    commit(next);
    const added = next[next.length - 1];
    setOpenCards((prev) => ({ ...prev, [added.value]: true }));
    setExpanded(true);
  }

  function updateSize(typeIndex: number, sizeIndex: number, patch: Partial<CargoSizeOption>) {
    const type = options[typeIndex];
    if (!type?.sizes) return;
    const sizes = type.sizes.map((size, i) => {
      if (i !== sizeIndex) return size;
      const merged = { ...size, ...patch };
      if (patch.label !== undefined && patch.value === undefined) {
        const slug = slugifyCargoValue(patch.label);
        if (slug && !type.sizes!.some((s, j) => j !== sizeIndex && s.value === slug)) {
          merged.value = slug;
        }
      }
      return merged;
    });
    updateType(typeIndex, { sizes });
  }

  function addSize(typeIndex: number) {
    const type = options[typeIndex];
    if (!type) return;
    const sizes = [...(type.sizes ?? []), newSizeOption(type.sizes ?? [])];
    updateType(typeIndex, { sizes });
  }

  function removeSize(typeIndex: number, sizeIndex: number) {
    const type = options[typeIndex];
    if (!type?.sizes) return;
    updateType(typeIndex, { sizes: type.sizes.filter((_, i) => i !== sizeIndex) });
  }

  function restoreDefaults() {
    if (
      !window.confirm(
        "Restore the standard cargo types (Vehicle, Container, General cargo, etc.)? Your current list will be replaced."
      )
    ) {
      return;
    }
    commit([...DEFAULT_CARGO_TYPES]);
  }

  function toggleCard(valueKey: string) {
    setOpenCards((prev) => ({ ...prev, [valueKey]: !prev[valueKey] }));
  }

  function handleAdvancedJsonChange(raw: string) {
    onChange(raw);
    setOptions(parseCargoOptions(raw));
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg-secondary)]/40 p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <div>
          <p className="text-sm font-medium text-[var(--platform-text)]">
            Cargo types on quote forms
          </p>
          <p className="mt-0.5 text-xs text-[var(--platform-text-secondary)]">
            {expanded
              ? "Choose what customers can pick when requesting a freight quote."
              : summary}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="mt-0.5 size-4 shrink-0 text-[var(--platform-text-secondary)]" />
        ) : (
          <ChevronDown className="mt-0.5 size-4 shrink-0 text-[var(--platform-text-secondary)]" />
        )}
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-[var(--platform-border)] pt-4">
          <p className="text-xs text-[var(--platform-text-secondary)]">
            Most businesses can keep the defaults. Expand a cargo type below to change its name,
            size choices, or optional detail fields.
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addType} className="platform-btn-secondary text-sm">
              <Plus className="size-4" />
              Add cargo type
            </button>
            <button
              type="button"
              onClick={restoreDefaults}
              className="platform-btn-ghost text-sm text-[var(--platform-text-secondary)]"
            >
              <RotateCcw className="size-4" />
              Restore defaults
            </button>
          </div>

          <div className="space-y-3">
            {options.map((option, typeIndex) => {
              const cardOpen = openCards[option.value] ?? typeIndex === 0;
              const cardId = `${baseId}-cargo-${option.value}`;
              return (
                <article
                  key={`${option.value}-${typeIndex}`}
                  className="overflow-hidden rounded-lg border border-[var(--platform-border)] bg-[var(--platform-card)]"
                >
                  <button
                    type="button"
                    onClick={() => toggleCard(option.value)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[rgba(107,33,168,0.04)]"
                    aria-expanded={cardOpen}
                    aria-controls={cardId}
                  >
                    <GripVertical
                      className="size-4 shrink-0 text-[var(--platform-text-secondary)]/50"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--platform-text)]">{option.label}</p>
                      <p className="text-xs text-[var(--platform-text-secondary)]">
                        {cargoTypeSummary(option)}
                      </p>
                    </div>
                    {cardOpen ? (
                      <ChevronUp className="size-4 shrink-0 text-[var(--platform-text-secondary)]" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0 text-[var(--platform-text-secondary)]" />
                    )}
                  </button>

                  {cardOpen ? (
                    <div id={cardId} className="space-y-4 border-t border-[var(--platform-border)] px-4 py-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block space-y-1.5 sm:col-span-2">
                          <span className="text-xs font-medium text-[var(--platform-text-secondary)]">
                            Cargo type name
                          </span>
                          <span className="block text-[11px] text-[var(--platform-text-secondary)]">
                            Shown in the dropdown on freight quote forms.
                          </span>
                          <input
                            className="platform-input w-full"
                            value={option.label}
                            onChange={(e) => updateType(typeIndex, { label: e.target.value })}
                            placeholder="e.g. Container"
                          />
                        </label>

                        {showAdvanced ? (
                          <label className="block space-y-1.5 sm:col-span-2">
                            <span className="text-xs font-medium text-[var(--platform-text-secondary)]">
                              Internal ID
                            </span>
                            <span className="block text-[11px] text-[var(--platform-text-secondary)]">
                              Used by the system — change only if you know what you are doing.
                            </span>
                            <input
                              className="platform-input w-full font-mono text-sm"
                              value={option.value}
                              onChange={(e) => updateType(typeIndex, { value: e.target.value })}
                            />
                          </label>
                        ) : null}

                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--platform-border)] px-3 py-2.5 sm:col-span-2">
                          <input
                            type="checkbox"
                            className="mt-0.5 size-4 rounded border-[var(--platform-border)]"
                            checked={Boolean(option.custom)}
                            onChange={(e) =>
                              updateType(typeIndex, {
                                custom: e.target.checked,
                                sizes: e.target.checked ? undefined : option.sizes ?? [{ value: "small", label: "Small" }],
                              })
                            }
                          />
                          <span>
                            <span className="block text-sm text-[var(--platform-text)]">
                              Let customer describe this themselves
                            </span>
                            <span className="text-xs text-[var(--platform-text-secondary)]">
                              Use for a free-text &quot;Custom&quot; option instead of fixed sizes.
                            </span>
                          </span>
                        </label>

                        {!option.custom ? (
                          <>
                            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--platform-border)] px-3 py-2.5 sm:col-span-2">
                              <input
                                type="checkbox"
                                className="mt-0.5 size-4 rounded border-[var(--platform-border)]"
                                checked={!option.sizes?.length}
                                onChange={(e) =>
                                  updateType(typeIndex, {
                                    sizes: e.target.checked
                                      ? undefined
                                      : [{ value: "small", label: "Small" }],
                                  })
                                }
                              />
                              <span>
                                <span className="block text-sm text-[var(--platform-text)]">
                                  No size selection needed
                                </span>
                                <span className="text-xs text-[var(--platform-text-secondary)]">
                                  e.g. &quot;Documents only&quot; — customer picks the type only.
                                </span>
                              </span>
                            </label>

                            {option.sizes?.length ? (
                              <>
                                <label className="block space-y-1.5 sm:col-span-2">
                                  <span className="text-xs font-medium text-[var(--platform-text-secondary)]">
                                    Size dropdown label
                                  </span>
                                  <span className="block text-[11px] text-[var(--platform-text-secondary)]">
                                    What sizes can customers choose for this cargo type?
                                  </span>
                                  <input
                                    className="platform-input w-full"
                                    value={option.sizeLabel ?? ""}
                                    onChange={(e) =>
                                      updateType(typeIndex, { sizeLabel: e.target.value })
                                    }
                                    placeholder="e.g. Container size"
                                  />
                                </label>

                                <div className="space-y-2 sm:col-span-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-[var(--platform-text-secondary)]">
                                      Size options
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => addSize(typeIndex)}
                                      className="platform-btn-ghost px-2 py-1 text-xs"
                                    >
                                      <Plus className="size-3.5" />
                                      Add size
                                    </button>
                                  </div>
                                  <div className="overflow-hidden rounded-lg border border-[var(--platform-border)]">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-[var(--platform-border)] bg-[var(--platform-bg-secondary)]/60 text-left text-xs text-[var(--platform-text-secondary)]">
                                          <th className="px-3 py-2 font-medium">Option name</th>
                                          {showAdvanced ? (
                                            <th className="px-3 py-2 font-medium">Internal ID</th>
                                          ) : null}
                                          <th className="w-10 px-2 py-2" aria-label="Remove" />
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {option.sizes.map((size, sizeIndex) => (
                                          <tr
                                            key={`${size.value}-${sizeIndex}`}
                                            className="border-b border-[var(--platform-border)] last:border-b-0"
                                          >
                                            <td className="px-3 py-2">
                                              <input
                                                className="platform-input w-full"
                                                value={size.label}
                                                onChange={(e) =>
                                                  updateSize(typeIndex, sizeIndex, {
                                                    label: e.target.value,
                                                  })
                                                }
                                                placeholder="e.g. 20ft"
                                              />
                                            </td>
                                            {showAdvanced ? (
                                              <td className="px-3 py-2">
                                                <input
                                                  className="platform-input w-full font-mono text-xs"
                                                  value={size.value}
                                                  onChange={(e) =>
                                                    updateSize(typeIndex, sizeIndex, {
                                                      value: e.target.value,
                                                    })
                                                  }
                                                />
                                              </td>
                                            ) : null}
                                            <td className="px-2 py-2 text-center">
                                              <button
                                                type="button"
                                                onClick={() => removeSize(typeIndex, sizeIndex)}
                                                className="rounded p-1 text-[var(--platform-danger)] hover:bg-[rgba(239,68,68,0.08)]"
                                                aria-label={`Remove ${size.label}`}
                                                disabled={option.sizes!.length <= 1}
                                              >
                                                <Trash2 className="size-4" />
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                <label className="block space-y-1.5 sm:col-span-2">
                                  <span className="text-xs font-medium text-[var(--platform-text-secondary)]">
                                    Optional details field label
                                  </span>
                                  <span className="block text-[11px] text-[var(--platform-text-secondary)]">
                                    Extra text box after size — leave blank to hide.
                                  </span>
                                  <input
                                    className="platform-input w-full"
                                    value={option.detailLabel ?? ""}
                                    onChange={(e) =>
                                      updateType(typeIndex, {
                                        detailLabel: e.target.value || undefined,
                                      })
                                    }
                                    placeholder="e.g. Make / model (optional)"
                                  />
                                </label>

                                {option.detailLabel ? (
                                  <label className="block space-y-1.5 sm:col-span-2">
                                    <span className="text-xs font-medium text-[var(--platform-text-secondary)]">
                                      Details field placeholder
                                    </span>
                                    <input
                                      className="platform-input w-full"
                                      value={option.detailPlaceholder ?? ""}
                                      onChange={(e) =>
                                        updateType(typeIndex, {
                                          detailPlaceholder: e.target.value || undefined,
                                        })
                                      }
                                      placeholder="e.g. 2022 Toyota RAV4"
                                    />
                                  </label>
                                ) : null}
                              </>
                            ) : null}
                          </>
                        ) : null}
                      </div>

                      <div className="flex justify-end border-t border-[var(--platform-border)] pt-3">
                        <button
                          type="button"
                          onClick={() => removeType(typeIndex)}
                          className="inline-flex items-center gap-1.5 text-sm text-[var(--platform-danger)] hover:underline"
                        >
                          <Trash2 className="size-4" />
                          Remove cargo type
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="border-t border-[var(--platform-border)] pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center gap-2 text-xs font-medium text-[var(--platform-text-secondary)] hover:text-[var(--platform-accent)]"
              aria-expanded={showAdvanced}
            >
              <Code2 className="size-3.5" />
              {showAdvanced ? "Hide advanced JSON" : "Advanced — edit raw JSON (developers)"}
            </button>
            {showAdvanced ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-[var(--platform-text-secondary)]">
                  Direct JSON editing. Invalid JSON will fall back to defaults on the public site.
                </p>
                <textarea
                  className="platform-input min-h-[12rem] w-full resize-y font-mono text-xs"
                  value={value}
                  onChange={(e) => handleAdvancedJsonChange(e.target.value)}
                  spellCheck={false}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
