/** Canonical Chinese brand list — single source of truth for filters and mock data. */
export const CHINESE_MAKES = [
  "BYD",
  "Geely",
  "Chery",
  "MG",
  "Haval",
  "Changan",
  "GWM",
  "Jetour",
  "DFSK",
  "BAIC",
  "Lynk & Co",
  "XPeng",
  "NIO",
  "Hongqi",
  "Zeekr",
  "Li Auto",
  "Aion",
  "Wuling",
  "Voyah",
  "Denza",
] as const;

export type ChineseMake = (typeof CHINESE_MAKES)[number];

export function isChineseMake(make: string): boolean {
  return CHINESE_MAKES.includes(make as ChineseMake);
}
