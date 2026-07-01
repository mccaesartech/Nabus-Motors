import { cn } from "@/lib/utils";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section";
}

export function Container({
  children,
  className,
  as: Component = "div",
}: ContainerProps) {
  return (
    <Component
      className={cn(
        "mx-auto w-full max-w-[min(100rem,100%)] px-4 sm:px-6 lg:px-10 xl:px-12 2xl:px-16",
        className
      )}
    >
      {children}
    </Component>
  );
}
