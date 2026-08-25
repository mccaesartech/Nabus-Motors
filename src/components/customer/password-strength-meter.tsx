"use client";

import { evaluatePasswordStrength } from "@/lib/customer/password-policy";

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = evaluatePasswordStrength(password);
  if (!password) return null;

  const barColor =
    strength.score <= 1
      ? "bg-red-500"
      : strength.score === 2
        ? "bg-amber-500"
        : strength.score === 3
          ? "bg-brand-purple"
          : "bg-emerald-600";

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Password strength</span>
        <span className="font-medium text-foreground">{strength.label}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all duration-300 ${barColor}`}
          style={{ width: `${strength.percent}%` }}
        />
      </div>
      <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        {strength.requirements.map((req) => (
          <li
            key={req.id}
            className={req.met ? "text-emerald-700" : undefined}
          >
            {req.met ? "✓" : "○"} {req.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
