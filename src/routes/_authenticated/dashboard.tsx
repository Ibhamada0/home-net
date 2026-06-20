import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/local-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge, TrendingUp, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "لوحة التحكم | Home Net" }] }),
});

const trafficData = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  download: Math.floor(Math.random() * 400) + 200,
  upload: Math.floor(Math.random() * 100) + 40,
}));

function KpiCard({ label, value, suffix, change, accent }: { label: string; value: string | number; suffix?: string; change?: string; accent?: "warning" | "primary" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{label}</div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-semibold ${accent === "warning" ? "text-destructive" : "text-foreground"}`}>{value}</span>
          {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
          {change && <span className="text-xs text-emerald-600 font-medium mr-auto flex items-center gap-1"><TrendingUp className="size-3" />{change}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const dayAgo = Date.now() - 24 * 3600 * 1000;
      const weekAhead = Date.now() + 7 * 24 * 3600 * 1000;
      const [customers, invoices, logs] = await Promise.all([
        db.customers.toArray(),
        db.invoices.toArray(),
        db.activity_log.orderBy("created_at").reverse().limit(8).toArray(),
      ]);
      const active = customers.filter((c) => c.status === "active").length;
      const dailyRevenue = invoices
        .filter((i) => i.status === "paid" && new Date(i.created_at).getTime() >= dayAgo)
        .reduce((s, i) => s + Number(i.amount), 0);
      const expiring = customers.filter(
        (c) => c.status === "active" && c.expire_at && new Date(c.expire_at).getTime() <= weekAhead,
      ).length;
      return {
        activeUsers: active,
        totalUsers: customers.length,
        dailyRevenue,
        expiring,
        logs,
      };
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground mt-1">نظرة عامة على أداء الشبكة والمستخدمين</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="المستخدمين النشطين" value={stats?.activeUsers ?? 0} />
        <KpiCard label="إجمالي المستخدمين" value={stats?.totalUsers ?? 0} />
        <KpiCard label="إيرادات اليوم" value={stats?.dailyRevenue?.toLocaleString() ?? 0} suffix="ر.س" />
        <KpiCard label="اشتراكات منتهية قريباً" value={stats?.expiring ?? 0} suffix="مستخدم" accent="warning" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
            <CardTitle className="text-sm font-semibold">مخطط حركة الشبكة (عرض توضيحي)</CardTitle>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-primary font-medium"><div className="size-2 rounded-full bg-primary" /> تحميل</div>
              <div className="flex items-center gap-1.5 text-muted-foreground font-medium"><div className="size-2 rounded-full bg-muted-foreground" /> رفع</div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficData}>
                  <defs>
                    <linearGradient id="dl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.58 0.11 190)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="oklch(0.58 0.11 190)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 247)" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" Mb" />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="download" stroke="oklch(0.58 0.11 190)" fill="url(#dl)" strokeWidth={2} />
                  <Area type="monotone" dataKey="upload" stroke="oklch(0.5 0.02 250)" fillOpacity={0} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-primary/10 grid place-items-center"><ArrowDownToLine className="size-4 text-primary" /></div>
                <div><div className="text-xs text-muted-foreground">إجمالي اليوم</div><div className="font-semibold">—</div></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-primary/10 grid place-items-center"><ArrowUpFromLine className="size-4 text-primary" /></div>
                <div><div className="text-xs text-muted-foreground">رفع اليوم</div><div className="font-semibold">—</div></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-success/10 grid place-items-center"><Gauge className="size-4 text-success" /></div>
                <div><div className="text-xs text-muted-foreground">حمل المعالج</div><div className="font-semibold">—</div></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-zinc-900 text-white border-0">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-white">أحدث الأنشطة</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(stats?.logs ?? []).length === 0 ? (
                <div className="text-xs border-r-2 border-primary/50 pr-3">
                  <p className="text-zinc-200">مرحباً بك في نظام Home Net 👋</p>
                  <span className="text-zinc-500 text-[10px]">ابدأ بإضافة باقات ومستخدمين</span>
                </div>
              ) : (
                stats?.logs.slice(0, 5).map((log) => (
                  <div key={log.id} className={`text-xs border-r-2 pr-3 ${log.severity === "error" ? "border-rose-500/50" : log.severity === "warning" ? "border-amber-500/50" : "border-primary/50"}`}>
                    <p className="text-zinc-200">{log.action}</p>
                    <span className="text-zinc-500 text-[10px]">{new Date(log.created_at).toLocaleString("ar-EG")}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
