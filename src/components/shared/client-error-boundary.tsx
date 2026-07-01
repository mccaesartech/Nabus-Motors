"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  attemptRecoverFromLoadFailure,
  isRecoverableLoadFailure,
} from "@/lib/cache-recovery";

interface ClientErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  label?: string;
}

interface ClientErrorBoundaryState {
  error: Error | null;
  recovering: boolean;
}

export class ClientErrorBoundary extends Component<
  ClientErrorBoundaryProps,
  ClientErrorBoundaryState
> {
  state: ClientErrorBoundaryState = { error: null, recovering: false };

  static getDerivedStateFromError(error: Error): Partial<ClientErrorBoundaryState> {
    if (isRecoverableLoadFailure(error)) {
      return { error, recovering: true };
    }
    return { error, recovering: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label ?? "ClientErrorBoundary"}]`, error, info);
    if (isRecoverableLoadFailure(error)) {
      attemptRecoverFromLoadFailure(error);
    }
  }

  private handleReset = () => {
    this.setState({ error: null, recovering: false });
    this.props.onReset?.();
  };

  render() {
    const { error, recovering } = this.state;

    if (recovering) {
      return (
        <div className="flex min-h-[8rem] items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Refreshing…
        </div>
      );
    }

    if (error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {this.props.label
              ? `${this.props.label} could not load.`
              : "This section could not load."}
          </p>
          <Button size="sm" variant="outline" onClick={this.handleReset}>
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
