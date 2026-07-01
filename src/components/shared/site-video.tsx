import {
  getVideoFrameClassName,
  getVideoMediaClassName,
  getVideoWrapperClassName,
  type SiteVideoDisplaySettings,
} from "@/lib/site-content/video-display";
import type { SiteVideoEmbedSettings } from "@/lib/site-content/video-embed";
import {
  parseEmbedVideoUrl,
  resolveVideo,
  type ResolvedVideo,
} from "@/lib/site-content/video";

type SiteVideoProps = {
  fileUrl?: string;
  embedUrl?: string;
  className?: string;
  /** Background hero mode: autoplay muted loop with cover fit */
  background?: boolean;
  /** Shown while a background file video loads */
  poster?: string;
  title?: string;
  display?: Partial<SiteVideoDisplaySettings>;
  embed?: Partial<SiteVideoEmbedSettings>;
};

function VideoPlayer({
  video,
  className,
  background,
  poster,
  title,
}: {
  video: ResolvedVideo;
  className?: string;
  background?: boolean;
  poster?: string;
  title?: string;
}) {
  if (video.type === "file") {
    return (
      <video
        src={video.url}
        className={className}
        autoPlay={background}
        muted={background}
        loop={background}
        playsInline
        controls={!background}
        poster={poster}
        aria-label={title ?? "Video"}
      />
    );
  }

  return (
    <iframe
      src={video.embedUrl}
      className={className}
      title={title ?? "Embedded video"}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen={!background}
    />
  );
}

export function SiteVideo({
  fileUrl = "",
  embedUrl = "",
  className = "",
  background = false,
  poster,
  title,
  display,
  embed,
}: SiteVideoProps) {
  const video = resolveVideo(fileUrl, embedUrl, { ...embed, background });
  if (!video) return null;

  if (background) {
    const fitClass =
      display?.videoObjectFit === "contain" ? "object-contain" : "object-cover";
    const bgClass = `absolute inset-0 h-full w-full opacity-60 ${fitClass}`;

    if (video.type !== "file") {
      return (
        <iframe
          src={video.embedUrl}
          title={title ?? "Hero background video"}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 opacity-60"
          allow="autoplay; fullscreen"
        />
      );
    }

    return (
      <VideoPlayer
        video={video}
        className={[bgClass, className].filter(Boolean).join(" ")}
        background={background}
        poster={poster}
        title={title}
      />
    );
  }

  const frameClass = getVideoFrameClassName(display, "bg-black");
  const mediaClass = getVideoMediaClassName(display);
  const wrapperClass = getVideoWrapperClassName(display);

  return (
    <div className={wrapperClass}>
      <div className={frameClass}>
        <VideoPlayer
          video={video}
          className={[mediaClass, className].filter(Boolean).join(" ")}
          background={background}
          title={title}
        />
      </div>
    </div>
  );
}

export function SiteVideoEmbed({
  url,
  className,
  title,
  display,
  embed,
}: {
  url: string;
  className?: string;
  title?: string;
  display?: Partial<SiteVideoDisplaySettings>;
  embed?: Partial<SiteVideoEmbedSettings>;
}) {
  const parsedEmbed = parseEmbedVideoUrl(url, embed);
  const fileUrl = !parsedEmbed && url.trim() ? url.trim() : "";
  const video =
    parsedEmbed ?? (fileUrl ? { type: "file" as const, url: fileUrl } : null);
  if (!video) return null;

  const frameClass = getVideoFrameClassName(display, "bg-black");
  const mediaClass = getVideoMediaClassName(display, className);
  const wrapperClass = getVideoWrapperClassName(display);

  return (
    <div className={wrapperClass}>
      <div className={frameClass}>
        <VideoPlayer video={video} className={mediaClass} background={false} title={title} />
      </div>
    </div>
  );
}
