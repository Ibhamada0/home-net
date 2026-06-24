import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, uid, exportBackup, importBackup, type RouterConfig } from "@/lib/local-db";
import { connectRouter } from "@/lib/mtk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Router, Save, Info, Download, Upload, Plug, Plus, Trash2, CheckCircle2, Power } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "إعدادات الراوتر | Home Net" }] }),
});

type FormState = Omit<RouterConfig, "created_at"> & { id: string };

const emptyForm = (): FormState => ({
  id: uid(),
  name: "Router 1",
  connection_mode: "local",
  host: "192.168.88.1",
  port: 80,
  cloud_hostname: null,
  username: "admin",
  password: "",
  use_https: false,
  is_active: true,
  proxy_url: typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : "http://localhost:8080",
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: profiles = [] } = useQuery({
    queryKey: ["router-profiles"],
    queryFn: async () => (await db.router_config.toArray()) as RouterConfig[],
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const isEditing = profiles.some((p) => p.id === form.id);

  function loadProfile(p: RouterConfig) {
    setSelectedId(p.id);
    setForm({ ...p });
    setStatus(null);
  }

  function newProfile() {
    setSelectedId(null);
    const f = emptyForm();
    f.name = `Router ${profiles.length + 1}`;
    setForm(f);
    setStatus(null);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: RouterConfig = { ...form, created_at: new Date().toISOString() };
      if (form.is_active) {
        // ensure single active
        await Promise.all(
          profiles.filter((p) => p.id !== form.id && p.is_active).map((p) =>
            db.router_config.update(p.id, { is_active: false })
          )
        );
      }
      if (isEditing) await db.router_config.update(form.id, payload);
      else await db.router_config.add(payload);
      localStorage.setItem("homenet_proxy_url", form.proxy_url);
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("تم الحفظ"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await db.router_config.delete(id); },
    onSuccess: () => { qc.invalidateQueries(); toast.success("تم الحذف"); newProfile(); },
  });

  const activate = useMutation({
    mutationFn: async (id: string) => {
      await Promise.all(profiles.map((p) =>
        db.router_config.update(p.id, { is_active: p.id === id })
      ));
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("تم تفعيل الاتصال"); },
  });

  async function doConnect() {
    setStatus(null);
    try {
      const res = await connectRouter(form as RouterConfig, form.proxy_url);
      const name = res.identity?.name || res.identity?.["="] || "";
      setStatus({ ok: true, text: `متصل ✓ (${res.via}) ${name ? `— ${name}` : ""}` });
      toast.success(`اتصال ناجح بـ ${name || form.host}`);
    } catch (e: any) {
      setStatus({ ok: false, text: e.message || String(e) });
      toast.error("فشل الاتصال: " + (e.message || String(e)));
    }
  }

  async function testProxy() {
    try {
      const r = await fetch(`${form.proxy_url}/health`);
      if (r.ok) toast.success("البروكسي يعمل ✓");
      else toast.error(`البروكسي رد بـ ${r.status}`);
    } catch {
      toast.error("لا يمكن الوصول للبروكسي");
    }
  }

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
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">إعدادات الراوتر</h1>
          <p className="text-sm text-muted-foreground mt-1">
            اتصال فوري على طريقة Mikhmon — بياناتك تتبعث مع كل طلب، تقدر تحفظ أكتر من راوتر وتبدّل بينهم.
          </p>
        </div>
        <Button onClick={newProfile} variant="outline"><Plus className="size-4 ml-1" /> راوتر جديد</Button>
      </div>

      {profiles.length > 0 && (
        <Card>
          <CardHeader><CardTitle>الراوترات المحفوظة</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {profiles.map((p) => (
              <div
                key={p.id}
                className={`rounded-lg border p-3 cursor-pointer transition ${
                  selectedId === p.id ? "border-primary ring-1 ring-primary" : "hover:bg-muted/40"
                }`}
                onClick={() => loadProfile(p)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Router className="size-4 shrink-0" />
                    <div className="font-medium truncate">{p.name}</div>
                  </div>
                  {p.is_active && <Badge className="gap-1"><CheckCircle2 className="size-3" /> نشط</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-mono" dir="ltr">
                  {p.username}@{p.host}:{p.port}{p.use_https ? " (https)" : ""}
                </div>
                <div className="flex gap-1 mt-2">
                  {!p.is_active && (
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); activate.mutate(p.id); }}>
                      <Power className="size-3 ml-1" /> تفعيل
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive"
                    onClick={(e) => { e.stopPropagation(); if (confirm(`حذف ${p.name}؟`)) remove.mutate(p.id); }}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 grid place-items-center"><Router className="size-5 text-primary" /></div>
            <div>
              <CardTitle>{isEditing ? `تعديل: ${form.name}` : "اتصال جديد"}</CardTitle>
              <CardDescription>اكتب بيانات MikroTik واضغط "اتصال" — زي Mikhmon بالظبط</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
            <Alert>
              <Info className="size-4" />
              <AlertTitle>قبل أول اتصال</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed mt-2 space-y-1">
                <div>1. على الراوتر: <code className="font-mono">/ip service enable www</code> (REST) أو <code className="font-mono">api</code> على 8728</div>
                <div>2. شغّل البروكسي مرة واحدة على جهازك: <code className="font-mono">node local-proxy/proxy.mjs</code></div>
                <div>3. اكتب IP والباسوورد واضغط "اتصال" — لو نجح احفظ.</div>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>عنوان البروكسي</Label>
              <div className="flex gap-2">
                <Input required value={form.proxy_url} onChange={(e) => setForm({ ...form, proxy_url: e.target.value })} dir="ltr" />
                <Button type="button" variant="outline" onClick={testProxy}>اختبار</Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>IP الراوتر</Label>
                <Input required placeholder="192.168.88.1" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>منفذ REST</Label>
                <Input type="number" required value={form.port} onChange={(e) => setForm({ ...form, port: +e.target.value })} dir="ltr" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>اسم المستخدم</Label>
                <Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>اسم مميّز لهذا الراوتر</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <Label>HTTPS</Label>
                <p className="text-xs text-muted-foreground">للاتصال عبر <code>www-ssl</code></p>
              </div>
              <Switch checked={form.use_https} onCheckedChange={(v) => setForm({ ...form, use_https: v, port: v ? 443 : 80 })} />
            </div>

            <div className="flex items-center justify-between">
              <div><Label>تعيينه كاتصال نشط</Label><p className="text-xs text-muted-foreground">يستخدمه التطبيق افتراضياً</p></div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>

            {status && (
              <Alert variant={status.ok ? "default" : "destructive"}>
                <AlertDescription className="text-sm">{status.text}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button type="button" onClick={doConnect} className="flex-1" variant="default">
                <Plug className="size-4 ml-1" /> اتصال
              </Button>
              <Button type="submit" className="flex-1" variant="secondary" disabled={save.isPending}>
                <Save className="size-4 ml-1" /> {isEditing ? "تحديث" : "حفظ"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>النسخ الاحتياطي</CardTitle>
          <CardDescription>تصدير أو استيراد كل بياناتك المحلية</CardDescription>
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
