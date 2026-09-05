import { FoldCrease, FoldIndex } from "@/components/fold/fold-primitives";

type NabusEditorialPageHeroProps = {
  label?: string;
  title: string;
  description?: string;
};

export function NabusEditorialPageHero({
  label: _label,
  title,
  description,
}: NabusEditorialPageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-[var(--nabus-ivory)] py-16 sm:py-22">
      <FoldCrease className="top-10 left-[-2%] opacity-80" />
      <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8 xl:px-10">
        <FoldIndex n={_label ? "PAGE" : "00"} />
        <h1 className="font-display mt-4 max-w-2xl text-[clamp(2.2rem,5vw,4rem)] leading-[1.06] text-[var(--nabus-graphite)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--nabus-muted)]">{description}</p>
        ) : null}
      </div>
    </section>
  );
}
