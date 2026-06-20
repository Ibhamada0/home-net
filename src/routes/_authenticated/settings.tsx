import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Router, Save, Info, Wifi, Cloud } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "إعدادات الراوتر | Home Net" }] }),
});

type Mode = "local" | "cloud";

function SettingsPage() {
  const qc = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["router-config-edit"],
    queryFn: async () => {
      const { data } = await supabase.from("router_config").select("*").maybeSingle();
      return data as any;
    },
  });

  const [form, setForm] = useState({
    name: "Main Router",
    connection_mode: "local" as Mode,
    host: "192.168.88.1",
    port: 8728,
    cloud_hostname: "",
    username: "admin",
    password: "",
    use_https: false,
    is_active: true,
  });

  useEffect(() => {
    if (config) setForm({
      name: config.name,
      connection_mode: (config.connection_mode ?? "local") as Mode,
      host: config.host,
      port: config.port,
      cloud_hostname: config.cloud_hostname ?? "",
      username: config.username,
      password: config.password,
      use_https: config.use_https,
      is_active: config.is_active,
    });
  }, [config]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      if (config) {
        const { error } = await supabase.from("router_config").update(payload as any).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("router_config").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("تم حفظ الإعدادات"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setMode = (m: Mode) => {
    setForm((f) => ({
      ...f,
      connection_mode: m,
      // Defaults per mode
      port: m === "local" ? (f.use_https ? 443 : 8728) : (f.use_https ? 443 : 80),
    }));
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إعدادات الراوتر</h1>
        <p className="text-sm text-muted-foreground mt-1">اختر طريقة الربط مع MikroTik: محلي عبر منفذ الـ API أو عن بُعد مجاناً عبر Cloudflare Tunnel / ngrok</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 grid place-items-center"><Router className="size-5 text-primary" /></div>
            <div>
              <CardTitle>اتصال الراوتر</CardTitle>
              <CardDescription>بيانات الدخول إلى MikroTik RouterOS</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
            <Tabs value={form.connection_mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="local" className="gap-2"><Wifi className="size-4" /> محلي (LAN)</TabsTrigger>
                <TabsTrigger value="cloud" className="gap-2"><Cloud className="size-4" /> نفق مجاني (Tunnel)</TabsTrigger>
              </TabsList>

              <TabsContent value="local" className="space-y-4 mt-4">
                <Alert>
                  <Info className="size-4" />
                  <AlertTitle>الوضع المحلي</AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed mt-2">
                    اتصال مباشر بـ MikroTik داخل نفس الشبكة عبر منفذ الـ API. فعّل الخدمة من
                    <code className="font-mono mx-1">/ip service enable api</code>
                    (المنفذ الافتراضي 8728) أو <code className="font-mono">api-ssl</code> (8729).
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label>عنوان IP المحلي</Label>
                    <Input required placeholder="192.168.88.1" value={form.host}
                      onChange={(e) => setForm({ ...form, host: e.target.value })} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>منفذ API</Label>
                    <Input type="number" required value={form.port}
                      onChange={(e) => setForm({ ...form, port: +e.target.value })} dir="ltr" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="cloud" className="space-y-4 mt-4">
                <Alert>
                  <Info className="size-4" />
                  <AlertTitle>عن بُعد عبر نفق مجاني (بدون VPS وبدون IP عام)</AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed mt-2 space-y-2">
                    <p>اختر إحدى الخدمتين المجانيتين على جهاز داخل نفس شبكة الراوتر (راوتر آخر، Raspberry Pi، أو أي PC):</p>
                    <div>
                      <strong>1) Cloudflare Tunnel (مجاني دائم):</strong>
                      <code className="block font-mono mt-1 ltr:text-left" dir="ltr">
                        cloudflared tunnel --url tcp://192.168.88.1:8728
                      </code>
                      <p className="mt-1">سيعطيك رابط مثل <code className="font-mono">xxx.trycloudflare.com</code> — استخدمه عبر <code className="font-mono">cloudflared access tcp</code> على جانب الخادم.</p>
                    </div>
                    <div>
                      <strong>2) ngrok (مجاني):</strong>
                      <code className="block font-mono mt-1 ltr:text-left" dir="ltr">
                        ngrok tcp 192.168.88.1:8728
                      </code>
                      <p className="mt-1">سيعطيك عنواناً مثل <code className="font-mono">0.tcp.ngrok.io</code> ومنفذاً مثل <code className="font-mono">17234</code> — ضعهما أدناه.</p>
                    </div>
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label>عنوان النفق (Tunnel Host)</Label>
                    <Input required={form.connection_mode === "cloud"} placeholder="0.tcp.ngrok.io"
                      value={form.cloud_hostname}
                      onChange={(e) => setForm({ ...form, cloud_hostname: e.target.value, host: e.target.value })}
                      dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>المنفذ</Label>
                    <Input type="number" required value={form.port}
                      onChange={(e) => setForm({ ...form, port: +e.target.value })} dir="ltr" />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

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
                <Label>استخدام TLS/SSL</Label>
                <p className="text-xs text-muted-foreground">
                  {form.connection_mode === "local" ? "api-ssl منفذ 8729" : "موصى به مع Cloudflare Tunnel"}
                </p>
              </div>
              <Switch checked={form.use_https}
                onCheckedChange={(v) => setForm({
                  ...form, use_https: v,
                  port: form.connection_mode === "local" ? (v ? 8729 : 8728) : (v ? 443 : 80),
                })} />
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
    </div>
  );
}
