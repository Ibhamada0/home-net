import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getSession, ensureBootstrap } from "@/lib/local-auth";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    ensureBootstrap().then(() => {
      navigate({ to: getSession() ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
      <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>
    </div>
  );
}
