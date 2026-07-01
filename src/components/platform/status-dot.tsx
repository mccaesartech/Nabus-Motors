import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  available: "bg-[#22C55E]",
  pre_order: "bg-[#22C55E]",
  reserved: "bg-[#F59E0B]",
  sold: "bg-[#737373]",
  new: "bg-[#8B5CF6]",
  pending: "bg-[#F59E0B]",
  contacted: "bg-[#22C55E]",
  qualified: "bg-[#2563EB]",
  closed: "bg-[#737373]",
};

type StatusDotProps = {
  status: string;
  className?: string;
  pulse?: boolean;
};

export function StatusDot({ status, className, pulse }: StatusDotProps) {
  const key = status.toLowerCase();
  const color = STATUS_COLORS[key] ?? "bg-[#737373]";

  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        color,
        pulse && "animate-pulse",
        className
      )}
      aria-hidden
    />
  );
}
