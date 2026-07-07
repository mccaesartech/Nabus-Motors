/** Lightweight local persistence for "Continue Your Journey" on the corporate homepage. */

export const LAST_INVENTORY_SEARCH_KEY = "true-goshen-last-inventory-search";
export const LAST_TRACKING_KEY = "true-goshen-last-tracking";
export const APPOINTMENT_BOOKED_KEY = "true-goshen-appointment-booked";
export const JOURNEY_HISTORY_EVENT = "true-goshen-journey-history-change";

export type LastTrackingEntry = {
  number: string;
  mode: "tracking" | "reference";
};

function notifyJourneyHistoryChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(JOURNEY_HISTORY_EVENT));
}

export function getLastInventorySearch(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(LAST_INVENTORY_SEARCH_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export function setLastInventorySearch(url: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_INVENTORY_SEARCH_KEY, url);
    notifyJourneyHistoryChange();
  } catch {
    // ignore quota / private-mode errors
  }
}

export function getLastTracking(): LastTrackingEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_TRACKING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastTrackingEntry;
    if (!parsed?.number?.trim()) return null;
    return {
      number: parsed.number.trim(),
      mode: parsed.mode === "reference" ? "reference" : "tracking",
    };
  } catch {
    return null;
  }
}

export function setLastTracking(entry: LastTrackingEntry) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_TRACKING_KEY, JSON.stringify(entry));
    notifyJourneyHistoryChange();
  } catch {
    // ignore quota / private-mode errors
  }
}

export function hasAppointmentBookedFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(APPOINTMENT_BOOKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAppointmentBooked() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(APPOINTMENT_BOOKED_KEY, "1");
    notifyJourneyHistoryChange();
  } catch {
    // ignore quota / private-mode errors
  }
}

export function subscribeJourneyHistory(callback: () => void) {
  window.addEventListener(JOURNEY_HISTORY_EVENT, callback);
  window.addEventListener("storage", callback);
  window.addEventListener("true-goshen-garage-change", callback);
  window.addEventListener("true-goshen-cart-change", callback);
  window.addEventListener("true-goshen-vehicle-preferences-change", callback);
  return () => {
    window.removeEventListener(JOURNEY_HISTORY_EVENT, callback);
    window.removeEventListener("storage", callback);
    window.removeEventListener("true-goshen-garage-change", callback);
    window.removeEventListener("true-goshen-cart-change", callback);
    window.removeEventListener("true-goshen-vehicle-preferences-change", callback);
  };
}
