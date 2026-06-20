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
import { Router, Save, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "إعدادات الراوتر | سيس-نت" }] }),
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["router-config-edit"],
    queryFn: async () => { const { data } = await supabase.from("router_config").select("*").maybeSingle(); return data; },
  });

  const [form, setForm] = useState({
    name: "Main Router", host: "", port: 443, username: "admin", password: "", use_https: true, is_active: true,
  });

  useEffect(() => {
    if (config) setForm({
      name: config.name, host: config.host, port: config.port, username: config.username,
      password: config.password, use_https: config.use_https, is_active: config.is_active,
    });
  }, [config]);

  const save = useMutation({
    mutationFn: async () => {
      if (config) {
        const { error } = await supabase.from("router_config").update(form).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("router_config").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("تم حفظ الإعدادات"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إعدادات الراوتر</h1>
        <p className="text-sm text-muted-foreground mt-1">إعداد الاتصال بـ MikroTik RouterOS عبر REST API</p>
      </div>

      <Alert>
        <Info className="size-4" />
        <AlertTitle>ملاحظة مهمة</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed mt-2">
          يتطلب RouterOS الإصدار 7.x أو أحدث مع تفعيل خدمة <code className="font-mono">www-ssl</code> أو <code className="font-mono">www</code>.
          يجب أن يكون الراوتر متاحاً عبر الإنترنت أو نفس الشبكة. لضمان الأمان استخدم HTTPS وأنشئ مستخدم API منفصل بصلاحيات محددة.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 grid place-items-center"><Router className="size-5 text-primary" /></div>
            <div>
              <CardTitle>اتصال الراوتر</CardTitle>
              <CardDescription>بيانات الدخول إلى MikroTik RouterOS REST API</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            <div className="space-y-2"><Label>اسم الراوتر</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2"><Label>عنوان IP أو دومين</Label><Input required placeholder="192.168.88.1" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} dir="ltr" /></div>
              <div className="space-y-2"><Label>المنفذ</Label><Input type="number" required value={form.port} onChange={(e) => setForm({ ...form, port: +e.target.value })} dir="ltr" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>اسم المستخدم</Label><Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} dir="ltr" /></div>
              <div className="space-y-2"><Label>كلمة المرور</Label><Input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" /></div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div><Label>استخدام HTTPS</Label><p className="text-xs text-muted-foreground">موصى به للأمان</p></div>
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
    </div>
  );
}
