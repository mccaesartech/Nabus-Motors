"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, Mail, MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { whatsappUrl } from "@/lib/constants";
import { toWhatsAppE164 } from "@/lib/notifications/phone";

function phoneTelHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return `tel:${cleaned || phone}`;
}

function gmailComposeUrl(email: string): string {
  return `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}`;
}

function useCopyFeedback() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  }

  return { copied, copy };
}

function useDropdownMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return { open, setOpen, ref, menuId };
}

type ContactMenuItemProps = {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
};

function ContactMenuItem({ icon, label, onClick, href, external }: ContactMenuItemProps) {
  const className =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-[var(--platform-text)] transition-colors hover:bg-[rgba(139,92,246,0.08)]";

  if (href) {
    return (
      <a
        href={href}
        className={className}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        onClick={onClick}
      >
        <span className="text-[var(--platform-accent)]">{icon}</span>
        {label}
      </a>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      <span className="text-[var(--platform-accent)]">{icon}</span>
      {label}
    </button>
  );
}

type ContactActionMenuProps = {
  trigger: ReactNode;
  children: ReactNode;
  ariaLabel: string;
  align?: "left" | "right";
};

function ContactActionMenu({ trigger, children, ariaLabel, align = "left" }: ContactActionMenuProps) {
  const { open, setOpen, ref, menuId } = useDropdownMenu();

  return (
    <div ref={ref} className="relative inline-block max-w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="platform-contact-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            "platform-contact-menu absolute z-50 mt-1 min-w-[11rem] p-1",
            align === "right" ? "right-0" : "left-0"
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

type ContactEmailActionProps = {
  email: string;
  className?: string;
  variant?: "inline" | "detail";
};

export function ContactEmailAction({ email, className, variant = "inline" }: ContactEmailActionProps) {
  const { copied, copy } = useCopyFeedback();

  async function handleCopy() {
    await copy(email);
  }

  const trigger =
    variant === "detail" ? (
      <span className="flex items-center gap-2 font-medium text-[var(--platform-accent)]">
        <Mail className="size-4 shrink-0" />
        <span className="break-all">{email}</span>
      </span>
    ) : (
      <span className={cn("break-all text-left text-[var(--platform-accent)] hover:underline", className)}>
        {email}
      </span>
    );

  return (
    <ContactActionMenu
      ariaLabel={`Email actions for ${email}`}
      trigger={trigger}
    >
      <ContactMenuItem
        icon={<ExternalLink className="size-3.5" />}
        label="Open in Gmail"
        href={gmailComposeUrl(email)}
        external
      />
      <ContactMenuItem
        icon={<Mail className="size-3.5" />}
        label="Compose email"
        href={`mailto:${email}`}
      />
      <ContactMenuItem
        icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        label={copied ? "Copied!" : "Copy email"}
        onClick={() => void handleCopy()}
      />
    </ContactActionMenu>
  );
}

type ContactPhoneActionProps = {
  phone: string;
  className?: string;
  variant?: "inline" | "detail";
};

export function ContactPhoneAction({ phone, className, variant = "inline" }: ContactPhoneActionProps) {
  const { copied, copy } = useCopyFeedback();

  async function handleCopy() {
    await copy(phone);
  }

  const trigger =
    variant === "detail" ? (
      <span className="flex items-center gap-2 font-medium text-[var(--platform-accent)]">
        <Phone className="size-4 shrink-0" />
        <span>{phone}</span>
      </span>
    ) : (
      <span
        className={cn(
          "text-left text-xs text-[var(--platform-text-secondary)] hover:text-[var(--platform-accent)] hover:underline",
          className
        )}
      >
        {phone}
      </span>
    );

  return (
    <ContactActionMenu
      ariaLabel={`Phone actions for ${phone}`}
      trigger={trigger}
    >
      <ContactMenuItem
        icon={<Phone className="size-3.5" />}
        label="Call"
        href={phoneTelHref(phone)}
      />
      <ContactMenuItem
        icon={<MessageCircle className="size-3.5" />}
        label="Contact on WhatsApp"
        href={whatsappUrl(undefined, toWhatsAppE164(phone).replace("+", ""))}
        external
      />
      <ContactMenuItem
        icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        label={copied ? "Copied!" : "Copy number"}
        onClick={() => void handleCopy()}
      />
    </ContactActionMenu>
  );
}

type ContactWhatsAppActionProps = {
  phone: string;
  customerName?: string;
  message?: string;
  variant?: "button" | "link";
  className?: string;
};

export function ContactWhatsAppAction({
  phone,
  customerName,
  message,
  variant = "link",
  className,
}: ContactWhatsAppActionProps) {
  const e164 = toWhatsAppE164(phone);
  const defaultMessage = customerName
    ? `Hi ${customerName}, this is True Goshen following up on your inquiry.`
    : "Hi, this is True Goshen following up on your inquiry.";
  const href = whatsappUrl(message ?? defaultMessage, e164.replace("+", ""));

  if (variant === "button") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("platform-btn-ghost inline-flex items-center gap-2", className)}
      >
        <MessageCircle className="size-4" />
        Contact on WhatsApp
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-xs text-[var(--platform-accent)] hover:underline",
        className
      )}
    >
      <MessageCircle className="size-3" />
      WhatsApp
    </a>
  );
}
