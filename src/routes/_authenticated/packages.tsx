import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, uid, type Package } from "@/lib/local-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Gauge, Calendar, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/packages")({
  component: PackagesPage,
  head: () => ({ meta: [{ title: "الباقات | Home Net" }] }),
});

function PackagesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);

  const { data: packages = [] } = useQuery({
    queryKey: ["packages-all"],
    queryFn: async () => (await db.packages.toArray()).sort((a, b) => a.price - b.price),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await db.packages.delete(id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["packages-all"] }); toast.success("تم الحذف"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">باقات الاشتراك</h1>
          <p className="text-sm text-muted-foreground mt-1">{packages.length} باقة</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="size-4 ml-1" /> باقة جديدة</Button></DialogTrigger>
          <PackageForm editing={editing} onClose={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((p) => (
          <Card key={p.id} className={!p.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <Badge variant="outline" className="mt-2 text-xs">{p.service_type === "pppoe" ? "PPPoE" : "Hotspot"}</Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm("حذف الباقة؟")) del.mutate(p.id); }}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-primary">{p.price}</span>
                <span className="text-sm text-muted-foreground">ر.س</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-3 border-t">
                <div><Zap className="size-4 mx-auto text-primary mb-1" /><div className="font-semibold">{p.speed_down_mbps}↓</div><div className="text-muted-foreground">Mbps</div></div>
                <div><Gauge className="size-4 mx-auto text-primary mb-1" /><div className="font-semibold">{p.speed_up_mbps}↑</div><div className="text-muted-foreground">Mbps</div></div>
                <div><Calendar className="size-4 mx-auto text-primary mb-1" /><div className="font-semibold">{p.duration_days}</div><div className="text-muted-foreground">يوم</div></div>
              </div>
              {p.description && <p className="text-xs text-muted-foreground border-t pt-3">{p.description}</p>}
            </CardContent>
          </Card>
        ))}
        {packages.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="p-12 text-center text-muted-foreground text-sm">
              لا توجد باقات بعد — اضغط "باقة جديدة"
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PackageForm({ editing, onClose }: { editing: Package | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    speed_down_mbps: editing?.speed_down_mbps ?? 10,
    speed_up_mbps: editing?.speed_up_mbps ?? 2,
    price: editing?.price ?? 100,
    duration_days: editing?.duration_days ?? 30,
    service_type: (editing?.service_type ?? "pppoe") as Package["service_type"],
    description: editing?.description ?? "",
    is_active: editing?.is_active ?? true,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await db.packages.update(editing.id, form);
      } else {
        await db.packages.add({
          id: uid(),
          ...form,
          created_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["packages-all"] }); toast.success("تم الحفظ"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent dir="rtl">
      <DialogHeader><DialogTitle>{editing ? "تعديل الباقة" : "باقة جديدة"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div className="space-y-2"><Label>اسم الباقة</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>سرعة التحميل (Mbps)</Label><Input type="number" required value={form.speed_down_mbps} onChange={(e) => setForm({ ...form, speed_down_mbps: +e.target.value })} /></div>
          <div className="space-y-2"><Label>سرعة الرفع (Mbps)</Label><Input type="number" required value={form.speed_up_mbps} onChange={(e) => setForm({ ...form, speed_up_mbps: +e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>السعر (ر.س)</Label><Input type="number" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} /></div>
          <div className="space-y-2"><Label>المدة (يوم)</Label><Input type="number" required value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: +e.target.value })} /></div>
        </div>
        <div className="space-y-2">
          <Label>نوع الخدمة</Label>
          <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v as Package["service_type"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pppoe">PPPoE</SelectItem>
              <SelectItem value="hotspot">Hotspot</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>الوصف</Label><Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="flex items-center justify-between">
          <Label>الباقة فعّالة</Label>
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "جارٍ..." : "حفظ"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
