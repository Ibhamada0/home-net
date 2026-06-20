import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, uid, exportBackup, importBackup } from "@/lib/local-db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Router, Save, Info, Download, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "إعدادات الراوتر | Home Net" }] }),
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["router-config-edit"],
    queryFn: async () => (await db.router_config.toArray())[0] ?? null,
  });

  const [form, setForm] = useState({
    name: "Main Router",
    host: "192.168.88.1",
    port: 80,
    username: "admin",
    password: "",
    use_https: false,
    is_active: true,
    proxy_url: "http://localhost:8080",
  });

  useEffect(() => {
    if (config) setForm({
      name: config.name,
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      use_https: config.use_https,
      is_active: config.is_active,
      proxy_url: config.proxy_url || "http://localhost:8080",
    });
  }, [config]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, connection_mode: "local" as const, cloud_hostname: null };
      if (config) {
        await db.router_config.update(config.id, payload);
      } else {
        await db.router_config.add({
          id: uid(),
          ...payload,
          created_at: new Date().toISOString(),
        });
      }
      localStorage.setItem("homenet_proxy_url", form.proxy_url);
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("تم حفظ الإعدادات"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const testProxy = async () => {
    try {
      const r = await fetch(`${form.proxy_url}/health`);
      if (r.ok) toast.success("البروكسي يعمل ✓");
      else toast.error(`البروكسي رد بـ ${r.status}`);
    } catch {
      toast.error("لا يمكن الوصول للبروكسي — تأكد أنه شغّال");
    }
  };

  const doExport = async () => {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `homenet-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const doImport = async (file: File) => {
    if (!confirm("سيتم استبدال كل البيانات الحالية. متأكد؟")) return;
    try {
      const data = JSON.parse(await file.text());
      await importBackup(data);
      qc.invalidateQueries();
      toast.success("تم استيراد النسخة الاحتياطية");
    } catch (e: any) {
      toast.error("ملف غير صالح: " + e.message);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إعدادات الراوتر</h1>
        <p className="text-sm text-muted-foreground mt-1">
          الاتصال محلي عبر البروكسي الصغير على جهازك — بدون كلاود ولا سيرفر.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 grid place-items-center"><Router className="size-5 text-primary" /></div>
            <div>
              <CardTitle>اتصال الراوتر</CardTitle>
              <CardDescription>بيانات الدخول إلى MikroTik REST API عبر البروكسي المحلي</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
            <Alert>
              <Info className="size-4" />
              <AlertTitle>طريقة التشغيل</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed mt-2 space-y-1">
                <div>1. فعّل REST API على الراوتر: <code className="font-mono">/ip service enable www</code></div>
                <div>2. شغّل البروكسي على جهازك: <code className="font-mono">node local-proxy/proxy.mjs</code></div>
                <div>3. تأكد أن العنوان وبيانات الدخول صحيحة هنا واضغط "اختبار البروكسي".</div>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>عنوان البروكسي المحلي</Label>
              <div className="flex gap-2">
                <Input required value={form.proxy_url} onChange={(e) => setForm({ ...form, proxy_url: e.target.value })} dir="ltr" />
                <Button type="button" variant="outline" onClick={testProxy}>اختبار</Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>عنوان IP للراوتر</Label>
                <Input required placeholder="192.168.88.1" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>منفذ REST</Label>
                <Input type="number" required value={form.port} onChange={(e) => setForm({ ...form, port: +e.target.value })} dir="ltr" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>اسم الراوتر</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>اسم المستخدم</Label>
                <Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <Input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <Label>استخدام HTTPS</Label>
                <p className="text-xs text-muted-foreground">للاتصال عبر <code>www-ssl</code> (المنفذ 443)</p>
              </div>
              <Switch checked={form.use_https} onCheckedChange={(v) => setForm({ ...form, use_https: v, port: v ? 443 : 80 })} />
            </div>

            <div className="flex items-center justify-between">
              <div><Label>الاتصال مفعّل</Label><p className="text-xs text-muted-foreground">استخدم هذا الراوتر كاتصال نشط</p></div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>

            <Button type="submit" className="w-full" disabled={save.isPending}>
              <Save className="size-4 ml-1" /> {save.isPending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>النسخ الاحتياطي</CardTitle>
          <CardDescription>تصدير أو استيراد كل بياناتك المحلية (عملاء، باقات، فواتير...)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={doExport}><Download className="size-4 ml-1" /> تصدير</Button>
          <label className="inline-flex">
            <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ""; }} />
            <span className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent cursor-pointer"><Upload className="size-4 ml-1" /> استيراد</span>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
