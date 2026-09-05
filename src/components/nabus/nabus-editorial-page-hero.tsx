import { NabusSectionLabel } from "./nabus-section-label";

type NabusEditorialPageHeroProps = {
  label?: string;
  title: string;
  description?: string;
};

export function NabusEditorialPageHero({
  label,
  title,
  description,
}: NabusEditorialPageHeroProps) {
  return (
    <section className="bg-[var(--nabus-warm-graphite)] py-16 sm:py-20">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
        {label ? <NabusSectionLabel tone="dark">{label}</NabusSectionLabel> : null}
        <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75">{description}</p>
        ) : null}
      </div>
    </section>
  );
}
