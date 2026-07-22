"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  DEFAULT_HERO_BACKGROUND_VIDEO_URL,
  DEFAULT_HERO_POSTER_URL,
} from "@/lib/constants";
import type { ResolvedVideo } from "@/lib/site-content/video";
import { cn } from "@/lib/utils";

type HeroBackgroundVideoProps = {
  video: ResolvedVideo;
  poster?: string;
  objectFit?: "cover" | "contain";
  /** Auto division uses portrait-hero (rotated landscape frames). Corporate uses full-bleed landscape. */
  layout?: "portrait-hero" | "landscape";
  /** When null, failed loads fall back to poster only (no shared auto stock clip). */
  fallbackVideoUrl?: string | null;
  /** Optional lower-bitrate clip for narrow viewports. */
  mobileVideoUrl?: string | null;
};

/** 9:16 portrait footage — fills portrait and landscape viewports without letterboxing. */
const PORTRAIT_COVER_CLASS =
  "pointer-events-none absolute left-1/2 top-1/2 z-0 h-[177.78vw] min-h-full w-[56.25vh] min-w-full max-w-none -translate-x-1/2 -translate-y-1/2 object-cover object-center";

function coverClassForVideo(rotateLandscapeFrames: boolean) {
  if (rotateLandscapeFrames) {
    return "pointer-events-none absolute left-1/2 top-1/2 z-0 h-[100vw] w-[100dvh] min-h-full min-w-full max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 object-cover object-center";
  }
  return PORTRAIT_COVER_CLASS;
}

const LANDSCAPE_EMBED_IFRAME_CLASS =
  "pointer-events-none absolute left-1/2 top-1/2 z-0 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2";

const LANDSCAPE_COVER_CLASS =
  "pointer-events-none absolute inset-0 z-0 h-full w-full object-center";

function HeroEmbedVideo({ embedUrl }: { embedUrl: string }) {
  return (
    <iframe
      src={embedUrl}
      title="Hero background video"
      className={LANDSCAPE_EMBED_IFRAME_CLASS}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

function tryPlayVideo(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;

  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Autoplay can still be blocked on some mobile browsers until interaction.
    });
  }
}

function HeroPosterFallback({
  poster,
  className,
}: {
  poster: string;
  className: string;
}) {
  const [src, setSrc] = useState(poster);

  return (
    <div className={className}>
      <Image
        src={src}
        alt=""
        aria-hidden
        fill
        preload
        sizes="100vw"
        decoding="async"
        className="object-cover object-center"
        onError={() => {
          if (src !== DEFAULT_HERO_POSTER_URL) {
            setSrc(DEFAULT_HERO_POSTER_URL);
          }
        }}
      />
    </div>
  );
}

function HeroFileVideo({
  src,
  poster,
  objectFit,
  layout,
  fallbackVideoUrl,
  mobileVideoUrl,
}: {
  src: string;
  poster?: string;
  objectFit: "cover" | "contain";
  layout: "portrait-hero" | "landscape";
  fallbackVideoUrl?: string | null;
  mobileVideoUrl?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [viewportSrc, setViewportSrc] = useState(src);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [showPosterFallback, setShowPosterFallback] = useState(false);
  /** Landscape-encoded frames that should display upright in a portrait hero. */
  const [rotateLandscapeFrames, setRotateLandscapeFrames] = useState(false);

  const resolvedPoster = poster?.trim() || DEFAULT_HERO_POSTER_URL;
  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";
  const coverClass =
    layout === "landscape"
      ? LANDSCAPE_COVER_CLASS
      : coverClassForVideo(rotateLandscapeFrames);
  const resolvedFallbackVideoUrl =
    fallbackVideoUrl === undefined ? DEFAULT_HERO_BACKGROUND_VIDEO_URL : fallbackVideoUrl;

  useEffect(() => {
    const pickSrc = () => {
      if (mobileVideoUrl && window.matchMedia("(max-width: 768px)").matches) {
        return mobileVideoUrl;
      }
      return src;
    };

    const applySrc = () => setViewportSrc(pickSrc());

    applySrc();
    const media = window.matchMedia("(max-width: 768px)");
    media.addEventListener("change", applySrc);
    return () => media.removeEventListener("change", applySrc);
  }, [src, mobileVideoUrl]);

  useEffect(() => {
    const enable = () => setShouldLoadVideo(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(enable, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(enable, 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!shouldLoadVideo) return;
    setVideoSrc(viewportSrc);
    setShowPosterFallback(false);
    setRotateLandscapeFrames(false);
  }, [viewportSrc, shouldLoadVideo]);

  const attemptPlay = useCallback(() => {
    const video = videoRef.current;
    if (video) tryPlayVideo(video);
  }, []);

  useLayoutEffect(() => {
    attemptPlay();
  }, [videoSrc, attemptPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const resumeIfPaused = () => {
      if (!document.hidden && !video.ended && video.paused) {
        tryPlayVideo(video);
      }
    };

    video.addEventListener("pause", resumeIfPaused);
    document.addEventListener("visibilitychange", resumeIfPaused);

    return () => {
      video.removeEventListener("pause", resumeIfPaused);
      document.removeEventListener("visibilitychange", resumeIfPaused);
    };
  }, [videoSrc]);

  const seamlessLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0.001;
    tryPlayVideo(video);
  }, []);

  const handleTimeUpdate = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    if (video.duration - video.currentTime < 0.12) {
      video.currentTime = 0.001;
    }
  }, []);

  const handleLoadedMetadata = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = event.currentTarget;
      if (layout === "portrait-hero") {
        setRotateLandscapeFrames(video.videoWidth > video.videoHeight);
      }
      attemptPlay();
    },
    [attemptPlay, layout]
  );

  const handleError = () => {
    if (mobileVideoUrl && videoSrc === mobileVideoUrl && src !== mobileVideoUrl) {
      setVideoSrc(src);
      return;
    }

    if (resolvedFallbackVideoUrl && videoSrc !== resolvedFallbackVideoUrl) {
      setVideoSrc(resolvedFallbackVideoUrl);
      return;
    }

    setShowPosterFallback(true);
  };

  if (showPosterFallback) {
    return (
      <div className="absolute inset-0 overflow-hidden bg-brand-charcoal-dark">
        <HeroPosterFallback
          poster={resolvedPoster}
          className={cn(coverClass, fitClass)}
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-brand-charcoal-dark">
      <HeroPosterFallback
        poster={resolvedPoster}
        className={cn(coverClass, fitClass)}
      />
      {shouldLoadVideo && videoSrc ? (
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          className={cn(coverClass, fitClass, layout === "portrait-hero" && "rotate-180")}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster={resolvedPoster}
          disablePictureInPicture
          aria-label="Hero background video"
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={attemptPlay}
          onPlaying={attemptPlay}
          onEnded={seamlessLoop}
          onTimeUpdate={handleTimeUpdate}
          onError={handleError}
        />
      ) : null}
    </div>
  );
}

export function HeroBackgroundVideo({
  video,
  poster,
  objectFit = "cover",
  layout = "portrait-hero",
  fallbackVideoUrl,
  mobileVideoUrl,
}: HeroBackgroundVideoProps) {
  if (video.type !== "file") {
    return <HeroEmbedVideo embedUrl={video.embedUrl} />;
  }

  return (
    <HeroFileVideo
      src={video.url}
      poster={poster}
      objectFit={objectFit === "contain" ? "contain" : "cover"}
      layout={layout}
      fallbackVideoUrl={fallbackVideoUrl}
      mobileVideoUrl={mobileVideoUrl}
    />
  );
}
