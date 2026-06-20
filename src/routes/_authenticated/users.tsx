import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, PowerOff, Power } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "مستخدمي PPPoE | Home Net" }] }),
});

type Customer = {
  id: string; username: string; password: string; full_name: string; phone: string | null;
  service_type: string; package_id: string | null; status: string; ip_address: string | null;
  expire_at: string | null; address: string | null;
};

function UsersPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const qc = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", "pppoe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, packages(name, speed_down_mbps, price)")
        .eq("service_type", "pppoe")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["packages-pppoe"],
    queryFn: async () => {
      const { data } = await supabase.from("packages").select("*").eq("service_type", "pppoe").eq("is_active", true);
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); toast.success("تم حذف المستخدم"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("customers").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); toast.success("تم تحديث الحالة"); },
  });

  const filtered = customers.filter((c) =>
    [c.username, c.full_name, c.phone, c.ip_address].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مستخدمي PPPoE</h1>
          <p className="text-sm text-muted-foreground mt-1">{customers.length} مستخدم مسجل</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 ml-1" /> إضافة مستخدم</Button>
          </DialogTrigger>
          <CustomerForm packages={packages} editing={editing} onClose={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم، اليوزر، IP..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
          </div>
        </CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اسم المستخدم</TableHead>
                <TableHead>الاسم الكامل</TableHead>
                <TableHead>الباقة</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تاريخ الانتهاء</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">جارٍ التحميل...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">لا يوجد مستخدمون. اضغط "إضافة مستخدم" للبدء.</TableCell></TableRow>
              ) : filtered.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.username}</TableCell>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.packages?.name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.ip_address ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "default" : c.status === "suspended" ? "destructive" : "secondary"}>
                      {c.status === "active" ? "نشط" : c.status === "suspended" ? "موقوف" : "منتهي"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.expire_at ? new Date(c.expire_at).toLocaleDateString("ar-EG") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => toggleMutation.mutate({ id: c.id, status: c.status === "active" ? "suspended" : "active" })}>
                        {c.status === "active" ? <PowerOff className="size-4" /> : <Power className="size-4 text-success" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("حذف المستخدم؟")) deleteMutation.mutate(c.id); }}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function CustomerForm({ packages, editing, onClose }: { packages: any[]; editing: Customer | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    username: editing?.username ?? "",
    password: editing?.password ?? "",
    full_name: editing?.full_name ?? "",
    phone: editing?.phone ?? "",
    address: editing?.address ?? "",
    package_id: editing?.package_id ?? "",
    ip_address: editing?.ip_address ?? "",
    status: editing?.status ?? "active",
  });

  const save = useMutation({
    mutationFn: async () => {
      const pkg = packages.find((p) => p.id === form.package_id);
      const expire_at = pkg ? new Date(Date.now() + pkg.duration_days * 24 * 3600 * 1000).toISOString() : null;
      const payload = { ...form, service_type: "pppoe", package_id: form.package_id || null, expire_at };
      if (editing) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(editing ? "تم تحديث المستخدم" : "تم إضافة المستخدم");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-lg" dir="rtl">
      <DialogHeader>
        <DialogTitle>{editing ? "تعديل المستخدم" : "إضافة مستخدم PPPoE"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>اسم المستخدم</Label><Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} dir="ltr" /></div>
          <div className="space-y-2"><Label>كلمة المرور</Label><Input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" /></div>
        </div>
        <div className="space-y-2"><Label>الاسم الكامل</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></div>
          <div className="space-y-2"><Label>IP (اختياري)</Label><Input value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} dir="ltr" /></div>
        </div>
        <div className="space-y-2">
          <Label>الباقة</Label>
          <Select value={form.package_id} onValueChange={(v) => setForm({ ...form, package_id: v })}>
            <SelectTrigger><SelectValue placeholder="اختر باقة" /></SelectTrigger>
            <SelectContent>
              {packages.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} — {p.price} ر.س</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
