import {
  extractYouTubeVideoId,
  extractVimeoVideoId,
  isDirectVideoUrl,
  parseEmbedVideoUrl,
} from "../src/lib/site-content/video";

const cases: { url: string; youtube?: string; vimeo?: string; direct?: boolean }[] = [
  { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", youtube: "dQw4w9WgXcQ" },
  { url: "https://youtube.com/watch?v=dQw4w9WgXcQ", youtube: "dQw4w9WgXcQ" },
  { url: "https://m.youtube.com/watch?v=dQw4w9WgXcQ", youtube: "dQw4w9WgXcQ" },
  { url: "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ", youtube: "dQw4w9WgXcQ" },
  { url: "https://youtu.be/dQw4w9WgXcQ", youtube: "dQw4w9WgXcQ" },
  { url: "https://youtu.be/dQw4w9WgXcQ?t=42", youtube: "dQw4w9WgXcQ" },
  { url: "https://www.youtube.com/embed/dQw4w9WgXcQ", youtube: "dQw4w9WgXcQ" },
  { url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", youtube: "dQw4w9WgXcQ" },
  { url: "https://www.youtube.com/shorts/dQw4w9WgXcQ", youtube: "dQw4w9WgXcQ" },
  { url: "https://vimeo.com/123456789", vimeo: "123456789" },
  { url: "https://player.vimeo.com/video/123456789", vimeo: "123456789" },
  { url: "/videos/corporate-hero.mp4", direct: true },
  { url: "https://example.com/clip.webm", direct: true },
  { url: "https://www.youtube.com/watch?v=notavalidid", youtube: undefined },
];

let failed = 0;

for (const { url, youtube, vimeo, direct } of cases) {
  const yt = extractYouTubeVideoId(url);
  const vm = extractVimeoVideoId(url);
  const isDirect = isDirectVideoUrl(url);
  const embed = parseEmbedVideoUrl(url);

  if (youtube !== undefined && yt !== youtube) {
    console.error(`YouTube FAIL: ${url}\n  expected ${youtube}, got ${yt}`);
    failed++;
  }
  if (vimeo !== undefined && vm !== vimeo) {
    console.error(`Vimeo FAIL: ${url}\n  expected ${vimeo}, got ${vm}`);
    failed++;
  }
  if (direct !== undefined && isDirect !== direct) {
    console.error(`Direct FAIL: ${url}\n  expected ${direct}, got ${isDirect}`);
    failed++;
  }
  if (youtube && embed?.type !== "youtube") {
    console.error(`Embed FAIL: ${url}\n  expected youtube embed`);
    failed++;
  }
  if (vimeo && embed?.type !== "vimeo") {
    console.error(`Embed FAIL: ${url}\n  expected vimeo embed`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}

console.log(`All ${cases.length} video URL cases passed.`);
