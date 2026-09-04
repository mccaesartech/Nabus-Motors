import { SITE_NAME } from "@/lib/constants";
import { getAutoSiteUrl } from "@/lib/site-url";
import { PRINT_LOGO_DATA_URL } from "@/lib/print/print-logo-data";

export { PRINT_LOGO_DATA_URL };
export const PRINT_LOGO_WIDTH = 140;
export const PRINT_LOGO_HEIGHT = 51;
/** Smaller intrinsic size for background watermark (display size set in CSS). */
export const PRINT_WATERMARK_WIDTH = 165;
export const PRINT_WATERMARK_HEIGHT = 60;

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Absolute URL fallback when inline data is unavailable (e.g. downloaded HTML). */
export function getPrintLogoUrl(): string {
  return `${getAutoSiteUrl()}/logo-purple.png`;
}

export function printLogoFallbackMarkup(): string {
  return `
    <div class="brand-logo-fallback" hidden>
      <span class="brand-logo-fallback-mark">TG</span>
      <span class="brand-logo-fallback-text">NABUS MOTORS</span>
      <span class="brand-logo-fallback-sub">AUTO</span>
    </div>
  `;
}

/** Centered semi-transparent watermark for invoice print/PDF backgrounds. */
export function printWatermarkMarkup(): string {
  const src = escapeAttr(PRINT_LOGO_DATA_URL);
  const urlFallback = escapeAttr(getPrintLogoUrl());

  return `
    <div class="document-watermark" aria-hidden="true">
      <img
        src="${src}"
        data-fallback-src="${urlFallback}"
        alt=""
        width="${PRINT_WATERMARK_WIDTH}"
        height="${PRINT_WATERMARK_HEIGHT}"
        onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src=this.dataset.fallbackSrc;}"
      />
    </div>
  `;
}

export function printLogoMarkup(alt = SITE_NAME): string {
  const safeAlt = escapeAttr(alt);
  const src = escapeAttr(PRINT_LOGO_DATA_URL);
  const urlFallback = escapeAttr(getPrintLogoUrl());

  return `
    <div class="brand-logo">
      <img
        class="brand-logo-img"
        src="${src}"
        data-fallback-src="${urlFallback}"
        alt="${safeAlt}"
        width="${PRINT_LOGO_WIDTH}"
        height="${PRINT_LOGO_HEIGHT}"
        onerror="if(!this.dataset.retried){this.dataset.retried='1';this.src=this.dataset.fallbackSrc;return;}this.hidden=true;var f=this.nextElementSibling;if(f)f.hidden=false;"
      />
      ${printLogoFallbackMarkup()}
    </div>
  `;
}
