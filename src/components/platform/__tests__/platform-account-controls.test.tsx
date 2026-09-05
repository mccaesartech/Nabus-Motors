import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlatformAccountMenu } from "@/components/platform/platform-account-menu";
import {
  createPlatformLogoutController,
} from "@/components/platform/platform-logout-action";
import { WelcomeHeader } from "@/components/platform/dashboard/welcome-header";
import { PlatformSidebarFooter } from "@/components/platform/sidebar";

describe("rendered platform account controls", () => {
  it.each(["owner", "super_admin", "manager", "staff"] as const)(
    "renders a semantic account-menu button for %s",
    (role) => {
      const html = renderToStaticMarkup(
        <PlatformAccountMenu userName="Alex Doe" userRole={role} />
      );

      expect(html).toContain("<button");
      expect(html).toContain('aria-haspopup="menu"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain("Open account menu for Alex Doe");
    }
  );

  it("renders plainly labeled sidebar logout in expanded and collapsed variants", () => {
    const expanded = renderToStaticMarkup(<PlatformSidebarFooter collapsed={false} />);
    const collapsed = renderToStaticMarkup(<PlatformSidebarFooter collapsed />);

    expect(expanded).toContain('aria-label="Account actions"');
    expect(expanded).toContain('data-testid="platform-sidebar-logout"');
    expect(expanded).toContain("Log out");
    expect(collapsed).toContain('aria-label="Log out"');
    expect(collapsed).toContain("sr-only");
    expect(collapsed).toContain("Log out");
  });

  it("mounts the account trigger in the dashboard header users actually see", () => {
    const html = renderToStaticMarkup(
      <WelcomeHeader userName="Assigned User" role="manager" />
    );

    expect(html).toContain('data-testid="platform-account-trigger-dashboard"');
    expect(html).toContain("Open account menu for Assigned User, Manager");
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain("Nabus Motors today");
  });
});

describe("platform logout controller", () => {
  it("invokes logout once while pending and redirects after success", async () => {
    let resolveLogout!: (href: string) => void;
    const requestLogout = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLogout = resolve;
        })
    );
    const onPendingChange = vi.fn();
    const onError = vi.fn();
    const onRedirect = vi.fn();
    const controller = createPlatformLogoutController({
      requestLogout,
      onPendingChange,
      onError,
      onRedirect,
    });

    const first = controller.run();
    const repeated = controller.run();
    expect(requestLogout).toHaveBeenCalledTimes(1);
    expect(onPendingChange).toHaveBeenCalledWith(true);

    resolveLogout("/admin");
    await Promise.all([first, repeated]);

    expect(onRedirect).toHaveBeenCalledWith("/admin");
    expect(onError).toHaveBeenCalledWith("");
  });

  it("restores the action and exposes a recoverable error", async () => {
    const onPendingChange = vi.fn();
    const onError = vi.fn();
    const controller = createPlatformLogoutController({
      requestLogout: vi.fn().mockRejectedValue(new Error("Session service unavailable.")),
      onPendingChange,
      onError,
      onRedirect: vi.fn(),
    });

    await controller.run();

    expect(onPendingChange.mock.calls).toEqual([[true], [false]]);
    expect(onError).toHaveBeenLastCalledWith("Session service unavailable.");
  });
});
