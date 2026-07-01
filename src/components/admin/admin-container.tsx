import { cn } from "@/lib/utils";

interface AdminContainerProps {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "header";
}

export function AdminContainer({
  children,
  className,
  as: Component = "div",
}: AdminContainerProps) {
  return (
    <Component
      className={cn(
        "mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-12",
        className
      )}
    >
      {children}
    </Component>
  );
}
