import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSession, onAuthChange, ensureBootstrap } from "@/lib/local-auth";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "authed">("checking");

  useEffect(() => {
    let mounted = true;
    ensureBootstrap().then(() => {
      if (!mounted) return;
      const s = getSession();
      if (!s) navigate({ to: "/auth", replace: true });
      else setState("authed");
    });
    const off = onAuthChange((s) => {
      if (!s) navigate({ to: "/auth", replace: true });
    });
    return () => { mounted = false; off(); };
  }, [navigate]);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
        <div className="text-sm text-muted-foreground">جارٍ التحقق...</div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
