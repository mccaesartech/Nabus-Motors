import Link from "next/link";
import { Phone, Mail } from "lucide-react";
import { SITE_PHONE_DISPLAY, SITE_EMAIL } from "@/lib/constants";
import { NABUS_UTILITY_LINKS } from "@/lib/nabus/nav";
import { cn } from "@/lib/utils";

export function NabusUtilityStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "hidden border-b border-[var(--nabus-border)] bg-[var(--nabus-charcoal)] text-white sm:block",
        className
      )}
    >
      <div className="mx-auto flex h-[var(--utility-strip-height)] max-w-7xl items-center justify-between px-4 text-xs sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <a
            href={`tel:${SITE_PHONE_DISPLAY.replace(/\s/g, "")}`}
            className="inline-flex items-center gap-1.5 text-white/80 transition-colors duration-200 hover:text-[var(--nabus-yellow)]"
          >
            <Phone className="size-3" />
            {SITE_PHONE_DISPLAY}
          </a>
          <a
            href={`mailto:${SITE_EMAIL}`}
            className="hidden items-center gap-1.5 text-white/80 transition-colors duration-200 hover:text-[var(--nabus-yellow)] md:inline-flex"
          >
            <Mail className="size-3" />
            {SITE_EMAIL}
          </a>
        </div>
        <nav aria-label="Utility" className="flex items-center gap-4">
          {NABUS_UTILITY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium text-white/75 transition-colors duration-200 hover:text-[var(--nabus-yellow)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
