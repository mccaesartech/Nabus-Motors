import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { Button } from "@/components/ui/button";
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
    "Learn about True Goshen Auto — our mission, quality standards, and commitment to customer trust.",
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
    <>
      <section className="relative bg-brand-primary py-20 sm:py-24">
        <Container>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">
            {about.eyebrow}
          </p>
          <h1 className="mt-4 max-w-xl text-3xl font-semibold text-white sm:text-4xl">
            {about.heroTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-on-dark-secondary">
            {about.heroSubtitle}
          </p>
        </Container>
      </section>

      {promoVideo && (
        <section className="border-b border-border bg-muted py-14 sm:py-16">
          <Container>
            {about.promoVideoTitle.trim() && (
              <h2 className="mb-6 text-center text-2xl font-semibold">{about.promoVideoTitle}</h2>
            )}
            <div className="overflow-hidden rounded-lg border border-border bg-black shadow-lg">
              <SiteVideoEmbed
                url={about.promoVideoEmbedUrl.trim() || about.promoVideoUrl.trim()}
                title={about.promoVideoTitle.trim() || "About True Goshen Auto"}
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
          </Container>
        </section>
      )}

      <section className="py-14 sm:py-16">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="relative aspect-[4/3] overflow-hidden">
              <SafeVehicleImage src={missionImage} alt="True Goshen Auto showroom" />
            </div>
            <div>
              <SectionHeader
                title={about.missionTitle}
                description={about.missionDescription}
                className="mb-0"
              />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {about.missionBody}
              </p>
              <Button className="mt-6" render={<Link href={ROUTES.auto.inventory} />}>
                View Our Inventory
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-y border-border bg-muted py-14 sm:py-16">
        <Container>
          <SectionHeader title={about.valuesTitle} align="center" className="mx-auto" />
          <div className="grid gap-8 sm:grid-cols-2">
            {about.values.map((value) => {
              const Icon = resolveSiteContentIcon(value.icon);
              return (
                <div key={value.title} className="flex gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                    <Icon className="size-5 text-foreground" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold">{value.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {value.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="py-14 sm:py-16">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <SectionHeader
                title={about.qualityTitle}
                description={about.qualityDescription}
                className="mb-0"
              />
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {about.qualityBullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="relative order-1 aspect-[4/3] overflow-hidden lg:order-2">
              <SafeVehicleImage src={qualityImage} alt="Vehicle inspection process" />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
