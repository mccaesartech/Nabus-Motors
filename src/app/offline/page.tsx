"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <Logo variant="purple" className="mx-auto h-12 w-auto" />
      <div className="mt-8 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <WifiOff className="size-7" aria-hidden />
      </div>
      <h1 className="mt-6 text-2xl font-semibold text-foreground">You are currently offline</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Nothing you entered has been lost. Pages you already visited still open from your device —
        use the back button to reach them. Reconnect and retry to load new content.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button render={<Link href="/" />}>Go to homepage</Button>
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    </div>
  );
}
