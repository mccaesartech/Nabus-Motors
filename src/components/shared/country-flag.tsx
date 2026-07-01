import * as Flags from "country-flag-icons/react/3x2";
import { hasFlag } from "country-flag-icons";
import type { CountryCode } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface CountryFlagProps {
  code: CountryCode;
  className?: string;
  title?: string;
}

export function CountryFlag({ code, className, title }: CountryFlagProps) {
  if (!hasFlag(code)) {
    return (
      <span
        aria-hidden={title ? undefined : true}
        aria-label={title}
        className={cn(
          "inline-flex h-4 w-6 shrink-0 items-center justify-center rounded-sm bg-muted text-[0.5rem] font-medium uppercase text-muted-foreground ring-1 ring-black/10",
          className
        )}
      >
        {code}
      </span>
    );
  }

  const Flag = Flags[code as keyof typeof Flags];

  return (
    <Flag
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn(
        "inline-block h-4 w-6 shrink-0 rounded-sm shadow-sm ring-1 ring-black/10",
        className
      )}
    />
  );
}
