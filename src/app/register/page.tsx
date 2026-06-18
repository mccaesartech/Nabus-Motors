"use client";

import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  return (
    <Container className="py-16 sm:py-20">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">Create Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Register to save vehicles, track prices, and manage your preferences.
        </p>
        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="reg-first">First Name</Label>
              <Input id="reg-first" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-last">Last Name</Label>
              <Input id="reg-last" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-email">Email</Label>
            <Input id="reg-email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-password">Password</Label>
            <Input id="reg-password" type="password" required />
          </div>
          <Button type="submit" className="w-full" size="lg">
            Create Account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-purple hover:text-brand-gold">
            Sign In
          </Link>
        </p>
      </div>
    </Container>
  );
}
