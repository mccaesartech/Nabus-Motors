import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { Button } from "@/components/ui/button";
import { NabusEditorialPageHero } from "@/components/nabus/nabus-editorial-page-hero";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import {
  getSiteContent,
  resolveAboutMissionImage,
  resolveAboutQualityImage,
} from "@/lib/site-content";
import { resolveSiteContentIcon } from "@/lib/site-content-icons";
import { resolveVideo } from "@/lib/site-content/video";
import { SiteVideoEmbed } from "@/components/shared/site-video";

export const metadata = {
  title: "About Us",
  description:
    "Learn about Nabus Motors — our mission, quality standards, and commitment to customer trust.",
};

export default async function AboutPage() {
  const content = await getSiteContent();
  const about = content.about;
  const missionImage = resolveAboutMissionImage(about);
  const qualityImage = resolveAboutQualityImage(about);
  const promoVideo = resolveVideo(about.promoVideoUrl, about.promoVideoEmbedUrl, {
    embedMinimalBranding: about.embedMinimalBranding,
    embedHideControls: about.embedHideControls,
    embedHideRelated: about.embedHideRelated,
  });

  return (
    <div className="bg-[var(--nabus-ivory)]">
      <NabusEditorialPageHero
        label={about.eyebrow}
        title={about.heroTitle}
        description={about.heroSubtitle}
      />

      {promoVideo ? (
        <section className="border-b border-[var(--nabus-border)] py-14 sm:py-16">
          <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
            {about.promoVideoTitle.trim() ? (
              <NabusSectionLabel className="mb-6">{about.promoVideoTitle}</NabusSectionLabel>
            ) : null}
            <div className="overflow-hidden border border-[var(--nabus-border)] bg-[var(--nabus-graphite)]">
              <SiteVideoEmbed
                url={about.promoVideoEmbedUrl.trim() || about.promoVideoUrl.trim()}
                title={about.promoVideoTitle.trim() || "About Nabus Motors"}
                display={{
                  videoAspect: about.videoAspect,
                  videoSize: about.videoSize,
                  videoObjectFit: about.videoObjectFit,
                }}
                embed={{
                  embedMinimalBranding: about.embedMinimalBranding,
                  embedHideControls: about.embedHideControls,
                  embedHideRelated: about.embedHideRelated,
                }}
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="relative aspect-[4/3] overflow-hidden border border-[var(--nabus-border)]">
              <SafeVehicleImage src={missionImage} alt="Nabus Motors showroom" />
            </div>
            <div>
              <NabusSectionLabel>Our Mission</NabusSectionLabel>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--nabus-graphite)] sm:text-3xl">
                {about.missionTitle}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--nabus-muted)]">
                {about.missionDescription}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--nabus-muted)]">
                {about.missionBody}
              </p>
              <Button
                className="mt-6 rounded-lg bg-[var(--nabus-wine)] hover:bg-[var(--nabus-crimson)]"
                render={<Link href={ROUTES.auto.inventory} />}
              >
                Browse The Showroom
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--nabus-border)] bg-[var(--nabus-paper)] py-14 sm:py-16">
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <NabusSectionLabel>{about.valuesTitle}</NabusSectionLabel>
          </div>
          <div className="mt-10 grid gap-px bg-[var(--nabus-border)] sm:grid-cols-2">
            {about.values.map((value) => {
              const Icon = resolveSiteContentIcon(value.icon);
              return (
                <div
                  key={value.title}
                  className="flex gap-4 bg-[var(--nabus-paper)] p-6 sm:p-8"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center border border-[var(--nabus-border)] bg-[var(--nabus-ivory)]">
                    <Icon className="size-5 text-[var(--nabus-wine)]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-[var(--nabus-graphite)]">
                      {value.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--nabus-muted)]">
                      {value.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="order-2 lg:order-1">
              <NabusSectionLabel>Quality</NabusSectionLabel>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--nabus-graphite)] sm:text-3xl">
                {about.qualityTitle}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--nabus-muted)]">
                {about.qualityDescription}
              </p>
              <ul className="mt-6 space-y-3 border-l-2 border-[var(--nabus-gold)] pl-4 text-sm text-[var(--nabus-muted)]">
                {about.qualityBullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="relative order-1 aspect-[4/3] overflow-hidden border border-[var(--nabus-border)] lg:order-2">
              <SafeVehicleImage src={qualityImage} alt="Vehicle inspection process" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
