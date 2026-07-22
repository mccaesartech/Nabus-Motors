import { swatchHexForColor } from "@/lib/vehicles/vehicle-colors";

type VehicleColorSwatchProps = {
  color: string;
  className?: string;
  size?: "sm" | "md";
};

export function VehicleColorSwatch({
  color,
  className = "",
  size = "sm",
}: VehicleColorSwatchProps) {
  const hex = swatchHexForColor(color);
  if (!hex) return null;

  const dim = size === "md" ? "size-4" : "size-3";

  return (
    <span
      className={`inline-block shrink-0 rounded-full border border-black/15 ${dim} ${className}`}
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
