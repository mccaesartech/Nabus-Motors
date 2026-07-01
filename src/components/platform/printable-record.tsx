"use client";

import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type PlatformPrintButtonProps = {
  label?: string;
  className?: string;
};

export function PlatformPrintButton({
  label = "Print",
  className,
}: PlatformPrintButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        "platform-btn-ghost no-print inline-flex items-center gap-2",
        className
      )}
    >
      <Printer className="size-4" />
      {label}
    </button>
  );
}

type PrintableRecordProps = {
  title: string;
  subtitle?: string;
  reference?: string;
  children: ReactNode;
  className?: string;
};

export function PrintableRecord({
  title,
  subtitle,
  reference,
  children,
  className,
}: PrintableRecordProps) {
  return (
    <div className={cn("platform-print-record", className)}>
      <header className="platform-print-header mb-6 hidden border-b border-[var(--platform-border)] pb-4 print:block">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="True Goshen"
              width={140}
              height={51}
              className="h-10 w-auto object-contain"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--platform-text)]">
                True Goshen Company Limited
              </p>
              <p className="text-xs text-[var(--platform-text-secondary)]">
                Vehicles · Freight · Parts
              </p>
            </div>
          </div>
          {reference ? (
            <p className="text-right text-xs text-[var(--platform-text-secondary)]">
              Ref <span className="font-mono font-medium text-[var(--platform-text)]">{reference}</span>
            </p>
          ) : null}
        </div>
        <div className="mt-4">
          <h1 className="text-lg font-semibold text-[var(--platform-text)]">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">{subtitle}</p>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}

type PrintFieldProps = {
  label: string;
  value: ReactNode;
  className?: string;
};

export function PrintField({ label, value, className }: PrintFieldProps) {
  return (
    <div className={className}>
      <p className="text-xs text-[var(--platform-text-secondary)]">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-[var(--platform-text)]">{value}</div>
    </div>
  );
}

type PrintSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function PrintSection({ title, children, className }: PrintSectionProps) {
  return (
    <section className={cn("platform-card overflow-hidden rounded-xl", className)}>
      <div className="border-b border-[var(--platform-border)] px-5 py-3">
        <h2 className="text-sm font-semibold text-[var(--platform-text)]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
