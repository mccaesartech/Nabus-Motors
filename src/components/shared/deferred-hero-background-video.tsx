"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const HeroBackgroundVideo = dynamic(
  () =>
    import("@/components/shared/hero-background-video").then((m) => ({
      default: m.HeroBackgroundVideo,
    })),
  { ssr: false }
);

type DeferredHeroBackgroundVideoProps = ComponentProps<typeof HeroBackgroundVideo>;

export function DeferredHeroBackgroundVideo(props: DeferredHeroBackgroundVideoProps) {
  return <HeroBackgroundVideo {...props} />;
}
