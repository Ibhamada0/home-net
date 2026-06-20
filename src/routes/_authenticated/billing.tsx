import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db, uid } from "@/lib/local-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
  head: () => ({ meta: [{ title: "الفواتير | Home Net" }] }),
});

function BillingPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const [inv, customers, packages] = await Promise.all([
        db.invoices.toArray(),
        db.customers.toArray(),
        db.packages.toArray(),
      ]);
      const cMap = new Map(customers.map((c) => [c.id, c]));
      const pMap = new Map(packages.map((p) => [p.id, p]));
      return inv
        .map((i) => ({
          ...i,
          customers: cMap.get(i.customer_id) ?? null,
          packages: i.package_id ? pMap.get(i.package_id) ?? null : null,
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      await db.invoices.update(id, { status: "paid", paid_at: new Date().toISOString() });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); toast.success("تم تأكيد الدفع"); },
  });

  const totalUnpaid = invoices.filter((i) => i.status === "unpaid").reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الفواتير</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة فواتير العملاء والمدفوعات</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 ml-1" /> فاتورة جديدة</Button></DialogTrigger>
          <InvoiceForm onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-1">إجمالي المدفوع</div><div className="text-2xl font-bold text-success">{totalPaid.toLocaleString()} ر.س</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-1">إجمالي غير المدفوع</div><div className="text-2xl font-bold text-destructive">{totalUnpaid.toLocaleString()} ر.س</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground mb-1">عدد الفواتير</div><div className="text-2xl font-bold">{invoices.length}</div></CardContent></Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الفاتورة</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الباقة</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="text-left">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">لا توجد فواتير بعد</TableCell></TableRow>
              ) : invoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                  <TableCell>
                    <div className="font-medium">{inv.customers?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{inv.customers?.username ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inv.packages?.name ?? "—"}</TableCell>
                  <TableCell className="font-semibold">{Number(inv.amount).toLocaleString()} ر.س</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "paid" ? "default" : inv.status === "cancelled" ? "secondary" : "destructive"}>
                      {inv.status === "paid" ? "مدفوعة" : inv.status === "cancelled" ? "ملغاة" : "غير مدفوعة"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString("ar-EG")}</TableCell>
                  <TableCell>
                    {inv.status === "unpaid" && (
                      <Button size="sm" variant="outline" onClick={() => markPaid.mutate(inv.id)}>
                        <CheckCircle2 className="size-4 ml-1" /> تأكيد الدفع
                      </Button>
                    )}
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

function InvoiceForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState("");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-all"],
    queryFn: async () => {
      const [cs, pkgs] = await Promise.all([db.customers.toArray(), db.packages.toArray()]);
      const pMap = new Map(pkgs.map((p) => [p.id, p]));
      return cs.map((c) => ({ ...c, packages: c.package_id ? pMap.get(c.package_id) ?? null : null }));
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const c = customers.find((x: any) => x.id === customerId) as any;
      if (!c) throw new Error("اختر عميل");
      const amount = c.packages?.price ?? 0;
      const due = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const last = (await db.invoices.toArray()).length + 1;
      await db.invoices.add({
        id: uid(),
        invoice_number: `INV-${String(last).padStart(5, "0")}`,
        customer_id: c.id,
        package_id: c.package_id,
        amount,
        status: "unpaid",
        due_date: due,
        paid_at: null,
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("تم إنشاء الفاتورة"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent dir="rtl">
      <DialogHeader><DialogTitle>فاتورة جديدة</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
        <div className="space-y-2">
          <Label>العميل</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
            <SelectContent>
              {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.username})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">سيتم إصدار الفاتورة بسعر باقة العميل الحالية ومدة 7 أيام للاستحقاق.</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={create.isPending}>إنشاء</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
