"use client";

import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <Container className="py-16 sm:py-20">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">Sign In</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Access your saved vehicles and account preferences.
        </p>
        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input id="login-email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Password</Label>
            <Input id="login-password" type="password" required />
          </div>
          <Button type="submit" className="w-full" size="lg">
            Sign In
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-brand-purple hover:text-brand-gold">
            Register
          </Link>
        </p>
      </div>
    </Container>
  );
}
