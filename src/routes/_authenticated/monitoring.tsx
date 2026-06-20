import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Cpu, HardDrive, Network } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/monitoring")({
  component: MonitoringPage,
  head: () => ({ meta: [{ title: "المراقبة الحية | سيس-نت" }] }),
});

const cpuData = Array.from({ length: 20 }, (_, i) => ({ t: i, cpu: 10 + Math.random() * 30, mem: 40 + Math.random() * 20 }));

function MonitoringPage() {
  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">المراقبة الحية</h1>
        <p className="text-sm text-muted-foreground mt-1">أداء الراوتر والاتصالات في الوقت الحقيقي</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Cpu, label: "المعالج", value: "14%", color: "text-primary" },
          { icon: HardDrive, label: "الذاكرة", value: "52%", color: "text-warning" },
          { icon: Network, label: "اتصالات نشطة", value: "1,284", color: "text-success" },
          { icon: Activity, label: "وقت التشغيل", value: "14 يوم", color: "text-foreground" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-muted grid place-items-center"><s.icon className={`size-5 ${s.color}`} /></div>
              <div><div className="text-xs text-muted-foreground">{s.label}</div><div className="text-xl font-semibold">{s.value}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="border-b pb-3"><CardTitle className="text-sm">استهلاك المعالج</CardTitle></CardHeader>
          <CardContent className="p-4 h-72">
            <ResponsiveContainer><LineChart data={cpuData}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 247)" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="cpu" stroke="oklch(0.58 0.11 190)" strokeWidth={2} dot={false} />
            </LineChart></ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-3"><CardTitle className="text-sm">استهلاك الذاكرة</CardTitle></CardHeader>
          <CardContent className="p-4 h-72">
            <ResponsiveContainer><LineChart data={cpuData}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 247)" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="mem" stroke="oklch(0.78 0.16 80)" strokeWidth={2} dot={false} />
            </LineChart></ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          💡 لعرض بيانات حقيقية من الراوتر، أعد إعداد الاتصال في صفحة <strong>إعدادات الراوتر</strong>.
        </CardContent>
      </Card>
    </div>
  );
}
