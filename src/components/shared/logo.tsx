import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "default" | "light";
}

export function Logo({ className, variant = "default" }: LogoProps) {
  return (
    <Link href="/" className={cn("flex items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/true-goshen-logo.png"
        alt="True Goshen Enterprise — Safe place"
        className={cn(
          "h-11 w-auto max-w-[190px] shrink-0 object-contain object-left",
          variant === "light" && "mix-blend-screen"
        )}
      />
    </Link>
  );
}
