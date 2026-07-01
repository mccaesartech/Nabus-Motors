import { cn } from "@/lib/utils";

type SidebarNavBadgeProps = {
  count: number;
  collapsed?: boolean;
  className?: string;
};

export function SidebarNavBadge({ count, collapsed, className }: SidebarNavBadgeProps) {
  if (count <= 0) return null;

  if (collapsed) {
    return (
      <span
        className={cn(
          "absolute right-1 top-1 size-2 rounded-full bg-violet-600 ring-2 ring-[var(--platform-bg-secondary)]",
          className
        )}
        aria-hidden
      />
    );
  }

  return (
    <span
      className={cn(
        "shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
