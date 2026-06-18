"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NewsletterForm() {
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="mt-4 flex gap-2"
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
        className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
        required
      />
      <Button
        type="submit"
        disabled={loading}
        className="shrink-0 bg-brand-gold text-brand-black hover:bg-brand-gold-muted"
      >
        {loading ? "…" : "Subscribe"}
      </Button>
    </form>
  );
}
