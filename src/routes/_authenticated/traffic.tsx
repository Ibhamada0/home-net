import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, uid, type BlockedDomain } from "@/lib/local-db";
import { mtk, getProxyUrl } from "@/lib/mtk";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Activity, ArrowDownToLine, ArrowUpFromLine, Crown, RefreshCw, Shield, Trash2, Plus, Database } from "lucide-react";
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

function toGB(n: number) {
  return (n / (1024 ** 3)).toFixed(2);
}

function TrafficPage() {
  const qc = useQueryClient();

  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: usage = [] } = useQuery({
    queryKey: ["traffic_usage", periodStart],
    queryFn: async () => {
      const [rows, customers] = await Promise.all([
        db.traffic_usage.where("period_start").equals(periodStart).toArray(),
        db.customers.toArray(),
      ]);
      const cMap = new Map(customers.map((c) => [c.id, c]));
      return rows
        .map((r) => ({ ...r, customers: cMap.get(r.customer_id) ?? null }))
        .sort((a, b) => Number(b.download_bytes) - Number(a.download_bytes));
    },
  });

  const totalUp = usage.reduce((a, r) => a + Number(r.upload_bytes), 0);
  const totalDown = usage.reduce((a, r) => a + Number(r.download_bytes), 0);
  const top = usage[0] as any;

  const sync = useMutation({
    mutationFn: async () => {
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
      const customers = await db.customers.toArray();
      let updated = 0;
      for (const c of customers) {
        const t = byName.get(c.username);
        if (!t) continue;
        const existing = await db.traffic_usage
          .where(["customer_id", "period_start"]).equals([c.id, periodStart]).first();
        if (existing) {
          await db.traffic_usage.update(existing.id, {
            upload_bytes: t.up,
            download_bytes: t.down,
            last_synced_at: new Date().toISOString(),
          });
        } else {
          await db.traffic_usage.add({
            id: uid(),
            customer_id: c.id,
            period_start: periodStart,
            upload_bytes: t.up,
            download_bytes: t.down,
            last_synced_at: new Date().toISOString(),
          });
        }
        updated++;
      }
      return { sessions: sessions.length, updated };
    },
    onSuccess: (d) => {
      toast.success(`تمت المزامنة (${d.updated} عميل من ${d.sessions} جلسة)`);
      qc.invalidateQueries({ queryKey: ["traffic_usage"] });
    },
    onError: async (e: any) =>
      toast.error(`${e.message} — تأكد أن البروكسي يعمل على ${await getProxyUrl()}`),
  });

  // ---------- filters ----------
  const { data: domains = [] } = useQuery({
    queryKey: ["blocked_domains"],
    queryFn: async () => {
      const [rows, pkgs] = await Promise.all([db.blocked_domains.toArray(), db.packages.toArray()]);
      const pMap = new Map(pkgs.map((p) => [p.id, p]));
      return rows
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((d) => ({ ...d, packages: d.package_id ? pMap.get(d.package_id) ?? null : null }));
    },
  });
  const { data: packages = [] } = useQuery({
    queryKey: ["packages-list"],
    queryFn: async () => db.packages.toArray(),
  });

  const [newD, setNewD] = useState({
    scope: "global" as BlockedDomain["scope"],
    package_id: "" as string,
    domain: "",
    note: "",
  });

  const addDomain = useMutation({
    mutationFn: async () => {
      await db.blocked_domains.add({
        id: uid(),
        scope: newD.scope,
        domain: newD.domain.trim(),
        note: newD.note || null,
        package_id: newD.scope === "package" ? newD.package_id : null,
        is_active: true,
        created_at: new Date().toISOString(),
      });
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
      await db.blocked_domains.update(v.id, { is_active: v.is_active });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked_domains"] }),
  });

  const delDomain = useMutation({
    mutationFn: async (id: string) => { await db.blocked_domains.delete(id); },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["blocked_domains"] }); },
  });

  const applyFilters = useMutation({
    mutationFn: async () => {
      const LIST = "homenet-blocked";
      const existing = await mtk(`/rest/ip/firewall/address-list?list=${LIST}`).catch(() => []);
      for (const row of existing ?? []) {
        await mtk(`/rest/ip/firewall/address-list/${row[".id"]}`, { method: "DELETE" }).catch(() => null);
      }
      const doms = (await db.blocked_domains.toArray())
        .filter((d) => d.scope === "global" && d.is_active);
      let added = 0;
      for (const d of doms) {
        try {
          await mtk("/rest/ip/firewall/address-list", {
            method: "PUT",
            body: JSON.stringify({ list: LIST, address: d.domain, comment: "homenet" }),
          });
          added++;
        } catch { /* ignore */ }
      }
      const rules = await mtk(`/rest/ip/firewall/filter?comment=homenet-block`).catch(() => []);
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
    onError: async (e: any) =>
      toast.error(`${e.message} — تأكد أن البروكسي يعمل على ${await getProxyUrl()}`),
  });

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">استهلاك الشبكة وفلترة المواقع</h1>
            <p className="text-sm text-muted-foreground">إحصائيات الاستهلاك الشهرية وإدارة الدومينات المحظورة</p>
          </div>
          <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className={`size-4 ml-2 ${sync.isPending ? "animate-spin" : ""}`} />
            مزامنة من الراوتر
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2"><Database className="size-4 text-primary" /> إجمالي الاستهلاك</CardDescription>
              <CardTitle className="text-3xl text-primary">{toGB(totalDown + totalUp)} <span className="text-base font-normal">GB</span></CardTitle>
              <div className="text-xs text-muted-foreground pt-1">{fmtBytes(totalDown + totalUp)}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2"><ArrowDownToLine className="size-4" /> التحميل</CardDescription>
              <CardTitle className="text-2xl">{toGB(totalDown)} <span className="text-sm font-normal">GB</span></CardTitle>
              <div className="text-xs text-muted-foreground pt-1">{fmtBytes(totalDown)}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2"><ArrowUpFromLine className="size-4" /> الرفع</CardDescription>
              <CardTitle className="text-2xl">{toGB(totalUp)} <span className="text-sm font-normal">GB</span></CardTitle>
              <div className="text-xs text-muted-foreground pt-1">{fmtBytes(totalUp)}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2"><Crown className="size-4 text-amber-500" /> أعلى مستهلك</CardDescription>
              <CardTitle className="text-lg">{top?.customers?.full_name ?? top?.customers?.username ?? "—"}</CardTitle>
              <div className="text-xs text-muted-foreground pt-1">
                {top ? `${toGB(Number(top.download_bytes) + Number(top.upload_bytes))} GB` : "—"}
              </div>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="usage" className="space-y-4">
          <TabsList>
            <TabsTrigger value="usage"><Activity className="size-4 ml-1" /> الاستهلاك حسب العميل</TabsTrigger>
            <TabsTrigger value="filters"><Shield className="size-4 ml-1" /> فلترة المواقع</TabsTrigger>
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
                    {usage.map((u: any, i: number) => (
                      <TableRow key={u.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{u.customers?.full_name ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{u.customers?.username}</TableCell>
                        <TableCell>{fmtBytes(Number(u.download_bytes))}</TableCell>
                        <TableCell>{fmtBytes(Number(u.upload_bytes))}</TableCell>
                        <TableCell className="font-semibold">{fmtBytes(Number(u.download_bytes) + Number(u.upload_bytes))}</TableCell>
                      </TableRow>
                    ))}
                    {usage.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">لا توجد بيانات بعد — اضغط "مزامنة من الراوتر"</TableCell></TableRow>
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
                  <CardDescription>قائمة عامة على كل الشبكة أو مرتبطة بباقة معينة</CardDescription>
                </div>
                <Button onClick={() => applyFilters.mutate()} disabled={applyFilters.isPending}>
                  <Shield className="size-4 ml-2" /> تطبيق على الراوتر
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <Label>النوع</Label>
                  <Select value={newD.scope} onValueChange={(v) => setNewD({ ...newD, scope: v as BlockedDomain["scope"], package_id: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">عام</SelectItem>
                      <SelectItem value="package">باقة محددة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newD.scope === "package" && (
                  <div>
                    <Label>الباقة</Label>
                    <Select value={newD.package_id} onValueChange={(v) => setNewD({ ...newD, package_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر باقة" /></SelectTrigger>
                      <SelectContent>
                        {packages.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className={newD.scope === "package" ? "" : "md:col-span-2"}>
                  <Label>الدومين / IP</Label>
                  <Input placeholder="example.com أو 1.2.3.4" value={newD.domain} onChange={(e) => setNewD({ ...newD, domain: e.target.value })} />
                </div>
                <div>
                  <Label>ملاحظة</Label>
                  <Input value={newD.note} onChange={(e) => setNewD({ ...newD, note: e.target.value })} />
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={() => addDomain.mutate()}
                    disabled={!newD.domain || (newD.scope === "package" && !newD.package_id) || addDomain.isPending}>
                    <Plus className="size-4 ml-1" /> إضافة
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>الدومينات المحظورة</CardTitle></CardHeader>
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
                    {domains.map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs">{d.domain}</TableCell>
                        <TableCell className="text-xs">{d.scope === "global" ? "عام" : `باقة: ${d.packages?.name ?? "—"}`}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{d.note ?? "—"}</TableCell>
                        <TableCell>
                          <Switch checked={d.is_active} onCheckedChange={(v) => toggleDomain.mutate({ id: d.id, is_active: v })} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("حذف الدومين؟")) delDomain.mutate(d.id); }}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {domains.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا توجد دومينات بعد</TableCell></TableRow>
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
