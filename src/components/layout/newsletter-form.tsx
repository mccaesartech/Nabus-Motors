"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NewsletterForm() {
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="mt-4 flex w-full flex-col gap-2.5 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const email = (e.currentTarget.querySelector('input[type="email"]') as HTMLInputElement).value;
        await fetch("/api/inquiries/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setLoading(false);
        e.currentTarget.reset();
      }}
    >
      <Input
        type="email"
        placeholder="Email address"
        className="h-10 min-w-0 flex-1 rounded-md border-white/20 bg-white/[0.08] text-sm text-white placeholder:text-white/40 focus-visible:border-brand-cta-gold/50 focus-visible:ring-brand-cta-gold/25"
        required
      />
      <Button
        type="submit"
        disabled={loading}
        className="h-10 shrink-0 rounded-md bg-brand-cta-gold px-5 text-sm font-semibold text-brand-charcoal hover:bg-brand-cta-gold-hover"
      >
        {loading ? "…" : "Subscribe"}
      </Button>
    </form>
  );
}
