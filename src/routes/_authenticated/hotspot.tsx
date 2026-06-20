import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hotspot")({
  component: HotspotPage,
  head: () => ({ meta: [{ title: "هوت سبوت | Home Net" }] }),
});

function HotspotPage() {
  const { data: users = [] } = useQuery({
    queryKey: ["customers", "hotspot"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("*, packages(name, price)").eq("service_type", "hotspot").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">نقطة الاتصال (Hotspot)</h1>
        <p className="text-sm text-muted-foreground mt-1">إدارة مستخدمي الواي فاي العام والكروت اليومية</p>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="p-16 text-center">
            <Wifi className="size-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold mb-1">لا يوجد مستخدمو هوت سبوت بعد</h3>
            <p className="text-sm text-muted-foreground">سيتم عرض المستخدمين هنا عند إضافتهم بنوع خدمة "hotspot".</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u: any) => (
            <Card key={u.id}>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-sm font-semibold">{u.username}</div>
                  <Badge variant={u.status === "active" ? "default" : "secondary"}>{u.status === "active" ? "نشط" : "موقوف"}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">{u.packages?.name}</div>
                <div className="text-xs text-muted-foreground">ينتهي: {u.expire_at ? new Date(u.expire_at).toLocaleDateString("ar-EG") : "—"}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
