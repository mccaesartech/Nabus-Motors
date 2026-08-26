"use client";

import type { PlatformNavItem } from "./nav";

const FAVORITES_KEY = "platform-nav-favorites";
const RECENT_KEY = "platform-nav-recent";
const COLLAPSED_GROUPS_KEY = "platform-nav-collapsed-groups";
const MAX_RECENT = 8;

export type RecentNavVisit = {
  href: string;
  label: string;
  visitedAt: string;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function getNavFavorites(): string[] {
  return readJson<string[]>(FAVORITES_KEY, []);
}

export function toggleNavFavorite(href: string): string[] {
  const current = getNavFavorites();
  const next = current.includes(href)
    ? current.filter((h) => h !== href)
    : [...current, href];
  writeJson(FAVORITES_KEY, next);
  return next;
}

export function isNavFavorite(href: string): boolean {
  return getNavFavorites().includes(href);
}

export function getRecentNavVisits(): RecentNavVisit[] {
  return readJson<RecentNavVisit[]>(RECENT_KEY, []);
}

export function recordNavVisit(item: Pick<PlatformNavItem, "href" | "label">): RecentNavVisit[] {
  const now = new Date().toISOString();
  const filtered = getRecentNavVisits().filter((v) => v.href !== item.href);
  const next: RecentNavVisit[] = [
    { href: item.href, label: item.label, visitedAt: now },
    ...filtered,
  ].slice(0, MAX_RECENT);
  writeJson(RECENT_KEY, next);
  return next;
}

export function getCollapsedNavGroups(): string[] {
  return readJson<string[]>(COLLAPSED_GROUPS_KEY, []);
}

export function setNavGroupCollapsed(
  groupId: string,
  collapsed: boolean,
  allGroupIds?: string[]
): string[] {
  const current = getCollapsedNavGroups();
  let next: string[];

  if (collapsed) {
    next = current.includes(groupId) ? current : [...current, groupId];
  } else if (current.length === 0 && allGroupIds?.length) {
    // First expand from pristine (empty storage): persist all other groups as collapsed.
    next = allGroupIds.filter((id) => id !== groupId);
  } else {
    next = current.filter((id) => id !== groupId);
  }

  writeJson(COLLAPSED_GROUPS_KEY, next);
  return next;
}

export function isNavGroupCollapsed(groupId: string): boolean {
  const stored = getCollapsedNavGroups();
  if (stored.length === 0) return true;
  return stored.includes(groupId);
}
