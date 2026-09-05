import { Logo } from "@/components/shared/logo";

type NabusAuthSplitShellProps = {
  panelTitle: string;
  panelBody: string;
  children: React.ReactNode;
};

export function NabusAuthSplitShell({
  panelTitle,
  panelBody,
  children,
}: NabusAuthSplitShellProps) {
  return (
    <div className="grid min-h-[calc(100dvh-var(--shell-top-offset))] bg-[var(--nabus-ivory)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[var(--nabus-warm-graphite)] lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--nabus-warm-graphite)] via-[#2a1018] to-[var(--nabus-wine)]/50" />
        <div className="relative flex h-full flex-col justify-end p-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--nabus-gold)]">
            Nabus Motors
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">{panelTitle}</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">{panelBody}</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:justify-start">
            <Logo variant="purple" brand="auto" height={48} srcOverride="/logo.png" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
