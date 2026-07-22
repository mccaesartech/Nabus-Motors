/**
 * True Goshen platform design tokens — semantic colors for status UI only.
 * Primary brand remains purple; do not replace accent with semantic colors.
 */
export const platformTokens = {
  primary: {
    purple: "#8b5cf6",
    purpleHover: "#7c3aed",
    purpleDeep: "#4c1d95",
    lavender: "#c4b5fd",
    lavenderLight: "#f5f3ff",
    lavenderBg: "#faf5ff",
  },
  accent: {
    gold: "#d97706",
  },
  semantic: {
    success: "#10b981",
    successBg: "rgba(16, 185, 129, 0.12)",
    warning: "#f59e0b",
    warningBg: "rgba(245, 158, 11, 0.12)",
    danger: "#ef4444",
    dangerBg: "rgba(239, 68, 68, 0.12)",
    info: "#3b82f6",
    infoBg: "rgba(59, 130, 246, 0.12)",
    neutral: "#6b7280",
    neutralBg: "rgba(107, 114, 128, 0.12)",
  },
  surface: {
    card: "#ffffff",
    background: "#faf5ff",
    backgroundSecondary: "#f5f3ff",
    border: "#e9d5ff",
    hoverTint: "rgba(139, 92, 246, 0.06)",
  },
} as const;

export type SemanticTone = "success" | "warning" | "danger" | "info" | "neutral";

export const semanticToneClasses: Record<
  SemanticTone,
  { text: string; bg: string; border: string }
> = {
  success: {
    text: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200/60",
  },
  warning: {
    text: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200/60",
  },
  danger: {
    text: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200/60",
  },
  info: {
    text: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200/60",
  },
  neutral: {
    text: "text-gray-600",
    bg: "bg-gray-50",
    border: "border-gray-200/60",
  },
};

export const activityIconColors: Record<string, { bg: string; text: string }> = {
  vehicle: { bg: "rgba(59, 130, 246, 0.12)", text: "#2563eb" },
  shipment: { bg: "rgba(245, 158, 11, 0.12)", text: "#d97706" },
  customer: { bg: "rgba(139, 92, 246, 0.12)", text: "#7c3aed" },
  payment: { bg: "rgba(16, 185, 129, 0.12)", text: "#059669" },
  message: { bg: "rgba(59, 130, 246, 0.12)", text: "#2563eb" },
  approval: { bg: "rgba(245, 158, 11, 0.12)", text: "#d97706" },
  support: { bg: "rgba(107, 114, 128, 0.12)", text: "#6b7280" },
  appointment: { bg: "rgba(139, 92, 246, 0.12)", text: "#8b5cf6" },
};
