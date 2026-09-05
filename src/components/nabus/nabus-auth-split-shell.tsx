import { Logo } from "@/components/shared/logo";
import { FoldCrease, FoldIndex } from "@/components/fold/fold-primitives";

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
    <div className="grid min-h-[calc(100dvh-var(--shell-top-offset))] bg-[var(--nabus-ivory)] lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
      <div className="relative hidden overflow-hidden bg-[var(--nabus-graphite)] lg:block">
        <FoldCrease className="top-[38%] left-0 w-[70%] max-w-none opacity-80" />
        <div className="relative flex h-full flex-col justify-end p-12">
          <FoldIndex n="IN" tone="ink" />
          <h2 className="font-display mt-4 max-w-sm text-4xl leading-[1.1] text-[var(--nabus-paper)]">
            {panelTitle}
          </h2>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">{panelBody}</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-14 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <Logo variant="purple" brand="auto" height={44} srcOverride="/logo.png" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
