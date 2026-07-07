"use client";

import { Play } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { ResolvedVideo } from "@/lib/site-content/video";
import { cn } from "@/lib/utils";

type SiteVideoPlayerProps = {
  video: ResolvedVideo;
  className?: string;
  background?: boolean;
  poster?: string;
  title?: string;
};

export function SiteVideoPlayer({
  video,
  className,
  background = false,
  poster,
  title,
}: SiteVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);
  const [fileError, setFileError] = useState(false);

  const tryAutoplay = useCallback(() => {
    const el = videoRef.current;
    if (!el || !background) return;

    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;

    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => setNeedsTapToPlay(true));
    }
  }, [background]);

  const handleTapToPlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;

    el.muted = true;
    el.playsInline = true;
    void el.play().then(() => setNeedsTapToPlay(false));
  }, []);

  if (video.type !== "file") {
    return (
      <iframe
        src={video.embedUrl}
        className={className}
        title={title ?? "Embedded video"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen={!background}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }

  if (fileError) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[12rem] w-full flex-col items-center justify-center gap-2 bg-muted px-4 text-center text-sm text-muted-foreground",
          className
        )}
        role="status"
      >
        <p className="font-medium text-foreground">Video could not be loaded</p>
        <p>Check the link or try again on a stronger connection.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        src={video.url}
        className={className}
        autoPlay={background}
        muted={background}
        loop={background}
        playsInline
        controls={!background}
        poster={poster}
        preload={background ? "none" : "metadata"}
        aria-label={title ?? "Video"}
        onLoadedData={tryAutoplay}
        onCanPlay={tryAutoplay}
        onError={() => setFileError(true)}
      />
      {needsTapToPlay && background ? (
        <button
          type="button"
          onClick={handleTapToPlay}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/35 text-white backdrop-blur-[1px]"
          aria-label="Tap to play video"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/50">
            <Play className="size-7 fill-white text-white" aria-hidden />
          </span>
          <span className="text-sm font-medium">Tap to play</span>
        </button>
      ) : null}
    </div>
  );
}
