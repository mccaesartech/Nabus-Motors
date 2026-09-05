import { cn } from "@/lib/utils";

type NabusArcProps = {
  className?: string;
  /** Horizontal flip */
  flip?: boolean;
  /** Gold intensity */
  variant?: "gold" | "subtle" | "wine";
  /** Width in px or CSS value */
  width?: string | number;
};

const strokeMap = {
  gold: "var(--nabus-gold)",
  subtle: "var(--nabus-gold-muted)",
  wine: "var(--nabus-wine)",
} as const;

/** Signature curved gold line motif — subtle editorial accent. */
export function NabusArc({
  className,
  flip = false,
  variant = "gold",
  width = "100%",
}: NabusArcProps) {
  const w = typeof width === "number" ? `${width}px` : width;

  return (
    <svg
      aria-hidden
      viewBox="0 0 320 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("pointer-events-none select-none", flip && "scale-x-[-1]", className)}
      style={{ width: w, height: "auto" }}
    >
      <path
        d="M0 40 C 80 4, 160 4, 320 36"
        stroke={strokeMap[variant]}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity={variant === "subtle" ? 0.45 : 0.85}
      />
      <path
        d="M24 44 C 96 18, 192 18, 296 42"
        stroke={strokeMap[variant]}
        strokeWidth="0.75"
        strokeLinecap="round"
        fill="none"
        opacity={0.35}
      />
    </svg>
  );
}
