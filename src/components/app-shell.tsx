import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Wifi, Package, Receipt, Activity, Settings, LogOut, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const items = [
  { title: "لوحة التحكم", url: "/dashboard", icon: LayoutDashboard },
  { title: "مستخدمي PPPoE", url: "/users", icon: Users },
  { title: "هوت سبوت", url: "/hotspot", icon: Wifi },
  { title: "الباقات", url: "/packages", icon: Package },
  { title: "الفواتير", url: "/billing", icon: Receipt },
  { title: "المراقبة الحية", url: "/monitoring", icon: Activity },
  { title: "إعدادات الراوتر", url: "/settings", icon: Settings },
  { title: "إدارة المستخدمين", url: "/admin-users", icon: ShieldCheck },
];

function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 p-2">
          <div className="size-9 bg-primary rounded-lg flex items-center justify-center ring-1 ring-black/5 shrink-0">
            <Wifi className="size-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="font-bold text-sidebar-foreground tracking-tight">Home Net</div>
            <div className="text-[10px] text-muted-foreground">إدارة مايكروتيك</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = path === item.url || (item.url !== "/dashboard" && path.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="size-4 shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="p-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <div className="bg-muted rounded-md p-2 ring-1 ring-black/5 mb-2">
            <div className="text-[10px] uppercase tracking-wider mb-1">إصدار النظام</div>
            <div className="text-xs font-semibold text-sidebar-foreground">RouterOS 7.x</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="justify-start gap-2">
          <LogOut className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">تسجيل الخروج</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

function TopBar() {
  const { data: router } = useQuery({
    queryKey: ["router-config"],
    queryFn: async () => {
      const { data } = await supabase.from("router_config").select("*").eq("is_active", true).maybeSingle();
      return data;
    },
  });

  return (
    <header className="h-14 border-b bg-card px-4 sm:px-6 flex items-center justify-between sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <div className="hidden sm:flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`size-2 rounded-full ${router ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
            <span className="text-sm font-medium text-muted-foreground">
              {router ? "الراوتر متصل" : "لم يتم إعداد الراوتر"}
            </span>
          </div>
          {router && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">IP:</span> {router.host}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
