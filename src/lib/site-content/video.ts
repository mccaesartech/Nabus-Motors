import { isValidImageUrl } from "@/lib/data/vehicle-images";
import {
  buildVimeoEmbedUrl,
  buildYouTubeEmbedUrl,
  type EmbedBuildContext,
} from "@/lib/site-content/video-embed";

export type VideoEmbedSource = {
  type: "youtube" | "vimeo";
  embedUrl: string;
};

export type VideoFileSource = {
  type: "file";
  url: string;
};

export type ResolvedVideo = VideoEmbedSource | VideoFileSource;

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

const VIMEO_PATTERNS = [
  /vimeo\.com\/(\d+)/,
  /player\.vimeo\.com\/video\/(\d+)/,
];

export function isDirectVideoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (isValidImageUrl(trimmed)) return false;
  return (
    /\.(mp4|webm)(\?|$)/i.test(trimmed) ||
    trimmed.includes("/storage/v1/object/public/") ||
    trimmed.startsWith("/videos/")
  );
}

export function parseEmbedVideoUrl(
  url: string,
  context: EmbedBuildContext = {}
): VideoEmbedSource | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  for (const pattern of YOUTUBE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return {
        type: "youtube",
        embedUrl: buildYouTubeEmbedUrl(match[1], context),
      };
    }
  }

  for (const pattern of VIMEO_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return {
        type: "vimeo",
        embedUrl: buildVimeoEmbedUrl(match[1], context),
      };
    }
  }

  return null;
}

export function resolveVideo(
  fileUrl: string,
  embedUrl: string,
  context: EmbedBuildContext = {}
): ResolvedVideo | null {
  const embed = parseEmbedVideoUrl(embedUrl, context);
  if (embed) return embed;

  const file = fileUrl.trim();
  if (file && isDirectVideoUrl(file)) {
    return { type: "file", url: file };
  }

  const fileAsEmbed = parseEmbedVideoUrl(file, context);
  if (fileAsEmbed) return fileAsEmbed;

  return null;
}

export function isValidVideoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return isDirectVideoUrl(trimmed) || parseEmbedVideoUrl(trimmed) !== null;
}
