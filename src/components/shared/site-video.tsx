import {
  getVideoFrameClassName,
  getVideoMediaClassName,
  getVideoWrapperClassName,
  type SiteVideoDisplaySettings,
} from "@/lib/site-content/video-display";
import type { SiteVideoEmbedSettings } from "@/lib/site-content/video-embed";
import {
  isDirectVideoUrl,
  looksLikeEmbedHostUrl,
  parseEmbedVideoUrl,
  resolveVideo,
} from "@/lib/site-content/video";
import { SiteVideoPlayer } from "@/components/shared/site-video-player";

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
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      );
    }

    return (
      <SiteVideoPlayer
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
        <SiteVideoPlayer
          video={video}
          className={[mediaClass, className].filter(Boolean).join(" ")}
          background={background}
          title={title}
        />
      </div>
    </div>
  );
}

function EmbedUrlError({ title }: { title?: string }) {
  return (
    <div
      className="flex h-full min-h-[12rem] w-full flex-col items-center justify-center gap-2 bg-muted px-4 text-center text-sm text-muted-foreground"
      role="status"
    >
      <p className="font-medium text-foreground">Video unavailable</p>
      <p>
        {title
          ? `We could not embed "${title}". Check that the YouTube or Vimeo link allows embedding.`
          : "Check that the YouTube or Vimeo link is public and allows embedding."}
      </p>
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
  const trimmed = url.trim();
  const parsedEmbed = parseEmbedVideoUrl(trimmed, embed);
  const fileUrl = !parsedEmbed && trimmed && isDirectVideoUrl(trimmed) ? trimmed : "";
  const video =
    parsedEmbed ?? (fileUrl ? { type: "file" as const, url: fileUrl } : null);

  const frameClass = getVideoFrameClassName(display, "bg-black");
  const mediaClass = getVideoMediaClassName(display, className);
  const wrapperClass = getVideoWrapperClassName(display);

  if (!video) {
    if (looksLikeEmbedHostUrl(trimmed)) {
      return (
        <div className={wrapperClass}>
          <div className={frameClass}>
            <EmbedUrlError title={title} />
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={wrapperClass}>
      <div className={frameClass}>
        <SiteVideoPlayer video={video} className={mediaClass} background={false} title={title} />
      </div>
    </div>
  );
}
