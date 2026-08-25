/** Shared customer password policy for register, reset, and change-password. */

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordRequirement = {
  id: "length" | "upper" | "lower" | "number" | "special";
  label: string;
  met: boolean;
};

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too weak" | "Weak" | "Fair" | "Strong" | "Excellent";
  percent: number;
  requirements: PasswordRequirement[];
  ok: boolean;
};

const SPECIAL = /[^A-Za-z0-9]/;

export function passwordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: "length",
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      met: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      id: "upper",
      label: "One uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      id: "lower",
      label: "One lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      id: "number",
      label: "One number",
      met: /[0-9]/.test(password),
    },
    {
      id: "special",
      label: "One special character",
      met: SPECIAL.test(password),
    },
  ];
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const requirements = passwordRequirements(password);
  const met = requirements.filter((r) => r.met).length;
  const ok = met === requirements.length;

  let score: PasswordStrength["score"] = 0;
  if (met <= 1) score = 0;
  else if (met === 2) score = 1;
  else if (met === 3) score = 2;
  else if (met === 4) score = 3;
  else score = 4;

  const labels: PasswordStrength["label"][] = [
    "Too weak",
    "Weak",
    "Fair",
    "Strong",
    "Excellent",
  ];

  return {
    score,
    label: labels[score],
    percent: Math.round((met / requirements.length) * 100),
    requirements,
    ok,
  };
}

export function validatePasswordPolicy(password: string): {
  ok: boolean;
  message: string;
  strength: PasswordStrength;
} {
  const strength = evaluatePasswordStrength(password);
  if (strength.ok) {
    return { ok: true, message: "", strength };
  }
  const missing = strength.requirements
    .filter((r) => !r.met)
    .map((r) => r.label.toLowerCase());
  return {
    ok: false,
    message: `Password must include ${missing.join(", ")}.`,
    strength,
  };
}
