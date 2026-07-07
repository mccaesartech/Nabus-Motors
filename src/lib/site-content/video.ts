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

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
];

const VIMEO_PATTERNS = [
  /vimeo\.com\/(\d+)/,
  /player\.vimeo\.com\/video\/(\d+)/,
];

/** True when the URL clearly targets a third-party embed host (not a direct file). */
export function looksLikeEmbedHostUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return /(?:youtube(?:-nocookie)?\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/i.test(
    trimmed
  );
}

export function extractYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.replace(/^www\./i, "").replace(/^m\./i, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split(/[/?#]/)[0];
      return id && YOUTUBE_ID.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery && YOUTUBE_ID.test(fromQuery)) return fromQuery;

      const fromPath = parsed.pathname.match(
        /\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/
      );
      if (fromPath?.[1]) return fromPath[1];
    }
  } catch {
    // Fall through to regex patterns for malformed URLs.
  }

  for (const pattern of YOUTUBE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1] && YOUTUBE_ID.test(match[1])) return match[1];
  }

  return null;
}

export function extractVimeoVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.replace(/^www\./i, "");

    if (host === "vimeo.com") {
      const id = parsed.pathname.replace(/^\//, "").split(/[/?#]/)[0];
      if (id && /^\d+$/.test(id)) return id;
    }

    if (host === "player.vimeo.com") {
      const match = parsed.pathname.match(/\/video\/(\d+)/);
      if (match?.[1]) return match[1];
    }
  } catch {
    // Fall through to regex patterns.
  }

  for (const pattern of VIMEO_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function isDirectVideoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (looksLikeEmbedHostUrl(trimmed)) return false;

  const hasVideoExtension = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(trimmed);
  const isStorageVideo = trimmed.includes("/storage/v1/object/public/");
  const isLocalVideo = trimmed.startsWith("/videos/");

  if (hasVideoExtension || isStorageVideo || isLocalVideo) return true;
  if (isValidImageUrl(trimmed)) return false;

  return false;
}

export function parseEmbedVideoUrl(
  url: string,
  context: EmbedBuildContext = {}
): VideoEmbedSource | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const youtubeId = extractYouTubeVideoId(trimmed);
  if (youtubeId) {
    return {
      type: "youtube",
      embedUrl: buildYouTubeEmbedUrl(youtubeId, context),
    };
  }

  const vimeoId = extractVimeoVideoId(trimmed);
  if (vimeoId) {
    return {
      type: "vimeo",
      embedUrl: buildVimeoEmbedUrl(vimeoId, context),
    };
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
