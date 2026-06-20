import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Crown,
  RefreshCw,
  Shield,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/traffic")({
  component: TrafficPage,
  head: () => ({ meta: [{ title: "استهلاك الشبكة | Home Net" }] }),
});

function fmtBytes(n: number) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(2)} ${u[i]}`;
}

const PROXY = (() => {
  try {
    return localStorage.getItem("homenet_proxy_url") || "http://localhost:8080";
  } catch {
    return "http://localhost:8080";
  }
})();

async function mtk(path: string, init?: RequestInit) {
  const res = await fetch(`${PROXY}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Router ${path} ${res.status}: ${await res.text().catch(() => "")}`);
  return res.status === 204 ? null : await res.json();
}


function TrafficPage() {
  const qc = useQueryClient();

  const { data: usage } = useQuery({
    queryKey: ["traffic_usage"],
    queryFn: async () => {
      const periodStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      ).toISOString();
      const { data } = await supabase
        .from("traffic_usage")
        .select("*, customers(full_name, username)")
        .eq("period_start", periodStart)
        .order("download_bytes", { ascending: false });
      return data ?? [];
    },
  });

  const totalUp = (usage ?? []).reduce((a: number, r: any) => a + Number(r.upload_bytes), 0);
  const totalDown = (usage ?? []).reduce((a: number, r: any) => a + Number(r.download_bytes), 0);
  const top = usage?.[0] as any;

  const sync = useMutation({
    mutationFn: async () => {
      // Pull active sessions directly from local router via proxy
      const [ppp, hs] = await Promise.all([
        mtk("/rest/ppp/active").catch(() => []),
        mtk("/rest/ip/hotspot/active").catch(() => []),
      ]);
      const sessions = [
        ...(Array.isArray(ppp) ? ppp : []),
        ...(Array.isArray(hs) ? hs : []),
      ];
      const byName = new Map<string, { up: number; down: number }>();
      for (const s of sessions) {
        const name = s.name ?? s.user;
        if (!name) continue;
        const up = Number(s["bytes-out"] ?? s.bytes_out ?? 0);
        const down = Number(s["bytes-in"] ?? s.bytes_in ?? 0);
        const cur = byName.get(name) ?? { up: 0, down: 0 };
        byName.set(name, { up: cur.up + up, down: cur.down + down });
      }
      const { data: customers } = await supabase.from("customers").select("id, username");
      const periodStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      ).toISOString();
      let updated = 0;
      for (const c of customers ?? []) {
        const t = byName.get(c.username);
        if (!t) continue;
        const { error } = await supabase.from("traffic_usage").upsert(
          {
            customer_id: c.id,
            period_start: periodStart,
            upload_bytes: t.up,
            download_bytes: t.down,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "customer_id,period_start" },
        );
        if (!error) updated++;
      }
      return { sessions: sessions.length, updated };
    },
    onSuccess: (d) => {
      toast.success(`تمت المزامنة (${d.updated} عميل من ${d.sessions} جلسة)`);
      qc.invalidateQueries({ queryKey: ["traffic_usage"] });
    },
    onError: (e: any) =>
      toast.error(
        `${e.message} — تأكد أن البروكسي المحلي يعمل على ${PROXY}`,
      ),
  });


  // ---------- filters ----------
  const { data: domains } = useQuery({
    queryKey: ["blocked_domains"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blocked_domains")
        .select("*, packages(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: packages } = useQuery({
    queryKey: ["packages-list"],
    queryFn: async () => {
      const { data } = await supabase.from("packages").select("id, name");
      return data ?? [];
    },
  });

  const [newD, setNewD] = useState({
    scope: "global" as "global" | "package",
    package_id: "" as string,
    domain: "",
    note: "",
  });

  const addDomain = useMutation({
    mutationFn: async () => {
      const payload: any = {
        scope: newD.scope,
        domain: newD.domain.trim(),
        note: newD.note || null,
        package_id: newD.scope === "package" ? newD.package_id : null,
      };
      const { error } = await supabase.from("blocked_domains").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الإضافة");
      setNewD({ scope: "global", package_id: "", domain: "", note: "" });
      qc.invalidateQueries({ queryKey: ["blocked_domains"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleDomain = useMutation({
    mutationFn: async (v: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("blocked_domains")
        .update({ is_active: v.is_active })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked_domains"] }),
  });

  const delDomain = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocked_domains").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["blocked_domains"] });
    },
  });

  const applyFilters = useMutation({
    mutationFn: async () => {
      const LIST = "homenet-blocked";
      // 1) clear existing entries in our list
      const existing = await mtk(
        `/rest/ip/firewall/address-list?list=${LIST}`,
      ).catch(() => []);
      for (const row of existing ?? []) {
        await mtk(`/rest/ip/firewall/address-list/${row[".id"]}`, {
          method: "DELETE",
        }).catch(() => null);
      }
      // 2) add active global domains
      const { data: doms } = await supabase
        .from("blocked_domains")
        .select("domain")
        .eq("scope", "global")
        .eq("is_active", true);
      let added = 0;
      for (const d of doms ?? []) {
        try {
          await mtk("/rest/ip/firewall/address-list", {
            method: "PUT",
            body: JSON.stringify({ list: LIST, address: d.domain, comment: "homenet" }),
          });
          added++;
        } catch {
          /* ignore individual failures (e.g. duplicate) */
        }
      }
      // 3) ensure drop rule exists
      const rules = await mtk(
        `/rest/ip/firewall/filter?comment=homenet-block`,
      ).catch(() => []);
      if (!rules || rules.length === 0) {
        await mtk("/rest/ip/firewall/filter", {
          method: "PUT",
          body: JSON.stringify({
            chain: "forward",
            action: "drop",
            "dst-address-list": LIST,
            comment: "homenet-block",
          }),
        }).catch(() => null);
      }
      return { added };
    },
    onSuccess: (d) => toast.success(`تم تطبيق ${d.added} قاعدة على الراوتر`),
    onError: (e: any) =>
      toast.error(
        `${e.message} — تأكد أن البروكسي المحلي يعمل على ${PROXY}`,
      ),
  });


  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">استهلاك الشبكة وفلترة المواقع</h1>
            <p className="text-sm text-muted-foreground">
              إحصائيات الاستهلاك الشهرية وإدارة الدومينات المحظورة
            </p>
          </div>
          <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className={`size-4 ml-2 ${sync.isPending ? "animate-spin" : ""}`} />
            مزامنة من الراوتر
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <ArrowDownToLine className="size-4" /> إجمالي التحميل
              </CardDescription>
              <CardTitle className="text-2xl">{fmtBytes(totalDown)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <ArrowUpFromLine className="size-4" /> إجمالي الرفع
              </CardDescription>
              <CardTitle className="text-2xl">{fmtBytes(totalUp)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Crown className="size-4 text-amber-500" /> أعلى مستهلك
              </CardDescription>
              <CardTitle className="text-lg">
                {top?.customers?.full_name ?? top?.customers?.username ?? "—"}
              </CardTitle>
              <div className="text-xs text-muted-foreground pt-1">
                {top ? fmtBytes(Number(top.download_bytes) + Number(top.upload_bytes)) : "—"}
              </div>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="usage" className="space-y-4">
          <TabsList>
            <TabsTrigger value="usage">
              <Activity className="size-4 ml-1" /> الاستهلاك حسب العميل
            </TabsTrigger>
            <TabsTrigger value="filters">
              <Shield className="size-4 ml-1" /> فلترة المواقع
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usage">
            <Card>
              <CardHeader>
                <CardTitle>ترتيب المستخدمين هذا الشهر</CardTitle>
                <CardDescription>الفترة: من بداية الشهر الحالي</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>اسم المستخدم</TableHead>
                      <TableHead>تحميل</TableHead>
                      <TableHead>رفع</TableHead>
                      <TableHead>الإجمالي</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(usage ?? []).map((u: any, i: number) => (
                      <TableRow key={u.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{u.customers?.full_name ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {u.customers?.username}
                        </TableCell>
                        <TableCell>{fmtBytes(Number(u.download_bytes))}</TableCell>
                        <TableCell>{fmtBytes(Number(u.upload_bytes))}</TableCell>
                        <TableCell className="font-semibold">
                          {fmtBytes(Number(u.download_bytes) + Number(u.upload_bytes))}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!usage || usage.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          لا توجد بيانات بعد — اضغط "مزامنة من الراوتر"
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="filters" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>إضافة دومين أو IP للحظر</CardTitle>
                  <CardDescription>
                    قائمة عامة على كل الشبكة أو مرتبطة بباقة معينة
                  </CardDescription>
                </div>
                <Button onClick={() => applyFilters.mutate()} disabled={applyFilters.isPending}>
                  <Shield className="size-4 ml-2" />
                  تطبيق على الراوتر
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <Label>النوع</Label>
                  <Select
                    value={newD.scope}
                    onValueChange={(v) =>
                      setNewD({ ...newD, scope: v as any, package_id: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">عام</SelectItem>
                      <SelectItem value="package">باقة محددة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newD.scope === "package" && (
                  <div>
                    <Label>الباقة</Label>
                    <Select
                      value={newD.package_id}
                      onValueChange={(v) => setNewD({ ...newD, package_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر باقة" />
                      </SelectTrigger>
                      <SelectContent>
                        {(packages ?? []).map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className={newD.scope === "package" ? "" : "md:col-span-2"}>
                  <Label>الدومين / IP</Label>
                  <Input
                    placeholder="example.com أو 1.2.3.4"
                    value={newD.domain}
                    onChange={(e) => setNewD({ ...newD, domain: e.target.value })}
                  />
                </div>
                <div>
                  <Label>ملاحظة</Label>
                  <Input
                    value={newD.note}
                    onChange={(e) => setNewD({ ...newD, note: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    onClick={() => addDomain.mutate()}
                    disabled={
                      !newD.domain ||
                      (newD.scope === "package" && !newD.package_id) ||
                      addDomain.isPending
                    }
                  >
                    <Plus className="size-4 ml-1" /> إضافة
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>الدومينات المحظورة</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الدومين/IP</TableHead>
                      <TableHead>النطاق</TableHead>
                      <TableHead>ملاحظة</TableHead>
                      <TableHead>نشط</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(domains ?? []).map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs">{d.domain}</TableCell>
                        <TableCell>
                          {d.scope === "global" ? (
                            <Badge>عام</Badge>
                          ) : (
                            <Badge variant="secondary">{d.packages?.name ?? "باقة"}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{d.note ?? "—"}</TableCell>
                        <TableCell>
                          <Switch
                            checked={d.is_active}
                            onCheckedChange={(v) =>
                              toggleDomain.mutate({ id: d.id, is_active: v })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => delDomain.mutate(d.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!domains || domains.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          لا توجد دومينات محظورة
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
