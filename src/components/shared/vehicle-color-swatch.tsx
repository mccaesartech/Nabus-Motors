import {
  swatchEdgeClass,
  swatchHexForColor,
} from "@/lib/vehicles/vehicle-colors";

type VehicleColorSwatchProps = {
  color: string;
  className?: string;
  size?: "sm" | "md";
  /** When set, skip label lookup and paint this hex directly. */
  hex?: string | null;
};

export function VehicleColorSwatch({
  color,
  className = "",
  size = "sm",
  hex: hexOverride,
}: VehicleColorSwatchProps) {
  const hex = hexOverride ?? swatchHexForColor(color);
  if (!hex) return null;

  const dim = size === "md" ? "size-4" : "size-3";

  return (
    <span
      className={`inline-block shrink-0 rounded-full border ${swatchEdgeClass(hex)} ${dim} ${className}`}
      style={{ backgroundColor: hex }}
      title={color}
      aria-hidden
    />
  );
}

type ExteriorColorValueProps = {
  color: string;
  emptyLabel?: string;
};

export function ExteriorColorValue({
  color,
  emptyLabel = "—",
}: ExteriorColorValueProps) {
  if (!color.trim()) {
    return <span className="font-medium text-muted-foreground">{emptyLabel}</span>;
  }

  return (
    <span className="inline-flex items-center gap-2 font-medium">
      <VehicleColorSwatch color={color} />
      {color}
    </span>
  );
}
