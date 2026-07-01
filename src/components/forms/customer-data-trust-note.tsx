type CustomerDataTrustNoteProps = {
  variant?: "form" | "admin";
  className?: string;
};

const MESSAGES = {
  form: "Your details are kept secure and used only for your shipment and support.",
  admin:
    "Customer data is stored securely and used only to fulfill orders and support.",
} as const;

export function CustomerDataTrustNote({
  variant = "form",
  className = "",
}: CustomerDataTrustNoteProps) {
  const tone =
    variant === "admin"
      ? "text-[var(--platform-text-secondary)]"
      : "text-muted-foreground";

  return (
    <p className={`text-xs ${tone} ${className}`.trim()} role="note">
      {MESSAGES[variant]}
    </p>
  );
}
