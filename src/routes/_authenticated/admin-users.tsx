import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAppUsers,
  createAppUser,
  setUserPassword,
  setUserRole,
  deleteAppUser,
  changeMyPassword,
  getMyRole,
} from "@/lib/admin-users.functions";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Trash2, KeyRound, UserPlus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin-users")({
  component: AdminUsersPage,
  head: () => ({ meta: [{ title: "إدارة المستخدمين | Home Net" }] }),
});

function AdminUsersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAppUsers);
  const create = useServerFn(createAppUser);
  const setPwd = useServerFn(setUserPassword);
  const setRole = useServerFn(setUserRole);
  const del = useServerFn(deleteAppUser);
  const myPwd = useServerFn(changeMyPassword);
  const myRoleFn = useServerFn(getMyRole);

  const { data: me } = useQuery({ queryKey: ["my-role"], queryFn: () => myRoleFn() });
  const isAdmin = me?.role === "admin";

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["app-users"],
    queryFn: () => list(),
    enabled: isAdmin,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["app-users"] });

  const [openNew, setOpenNew] = useState(false);
  const [newU, setNewU] = useState({ email: "", password: "", full_name: "", role: "staff" as "admin" | "staff" });
  const createMut = useMutation({
    mutationFn: () => create({ data: newU }),
    onSuccess: () => {
      toast.success("تم إنشاء المستخدم");
      setOpenNew(false);
      setNewU({ email: "", password: "", full_name: "", role: "staff" });
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [pwdFor, setPwdFor] = useState<string | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const pwdMut = useMutation({
    mutationFn: () => setPwd({ data: { user_id: pwdFor!, password: pwdValue } }),
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور");
      setPwdFor(null);
      setPwdValue("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; role: "admin" | "staff" }) => setRole({ data: v }),
    onSuccess: () => {
      toast.success("تم تحديث الصلاحية");
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (user_id: string) => del({ data: { user_id } }),
    onSuccess: () => {
      toast.success("تم حذف المستخدم");
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [myNewPwd, setMyNewPwd] = useState("");
  const myPwdMut = useMutation({
    mutationFn: () => myPwd({ data: { password: myNewPwd } }),
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور الخاصة بك");
      setMyNewPwd("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto" dir="rtl">
        <div>
          <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
          <p className="text-muted-foreground text-sm">
            إدارة مستخدمي النظام، الصلاحيات، وكلمات المرور
          </p>
        </div>

        {/* Change my password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-5" /> تغيير كلمة المرور الخاصة بي
            </CardTitle>
            <CardDescription>كلمة مرور جديدة لحسابك الحالي</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Input
              type="password"
              placeholder="كلمة مرور جديدة (٦ أحرف على الأقل)"
              value={myNewPwd}
              onChange={(e) => setMyNewPwd(e.target.value)}
              className="sm:max-w-sm"
            />
            <Button
              onClick={() => myPwdMut.mutate()}
              disabled={myNewPwd.length < 6 || myPwdMut.isPending}
            >
              تحديث كلمة المرور
            </Button>
          </CardContent>
        </Card>

        {!isAdmin ? (
          <Alert>
            <ShieldAlert className="size-4" />
            <AlertTitle>صلاحية محدودة</AlertTitle>
            <AlertDescription>
              إدارة المستخدمين الآخرين متاحة لحسابات المدير فقط.
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>المستخدمون</CardTitle>
                <CardDescription>قائمة كل المستخدمين في النظام</CardDescription>
              </div>
              <Dialog open={openNew} onOpenChange={setOpenNew}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="size-4 ml-1" /> مستخدم جديد
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إضافة مستخدم</DialogTitle>
                    <DialogDescription>سيتم تأكيد البريد تلقائياً</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>الاسم الكامل</Label>
                      <Input
                        value={newU.full_name}
                        onChange={(e) => setNewU({ ...newU, full_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>البريد الإلكتروني</Label>
                      <Input
                        type="email"
                        value={newU.email}
                        onChange={(e) => setNewU({ ...newU, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>كلمة المرور</Label>
                      <Input
                        type="password"
                        value={newU.password}
                        onChange={(e) => setNewU({ ...newU, password: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>الصلاحية</Label>
                      <Select
                        value={newU.role}
                        onValueChange={(v) => setNewU({ ...newU, role: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">مدير</SelectItem>
                          <SelectItem value="staff">موظف</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createMut.mutate()}
                      disabled={createMut.isPending || !newU.email || newU.password.length < 6}
                    >
                      إنشاء
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoading && <div className="text-sm text-muted-foreground">جاري التحميل...</div>}
              {error && (
                <div className="text-sm text-destructive">{(error as Error).message}</div>
              )}
              {users && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>البريد</TableHead>
                      <TableHead>الصلاحية</TableHead>
                      <TableHead className="text-left">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.full_name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Select
                            value={u.role}
                            onValueChange={(v) =>
                              roleMut.mutate({ user_id: u.id, role: v as "admin" | "staff" })
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">مدير</SelectItem>
                              <SelectItem value="staff">موظف</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex gap-2 justify-start">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPwdFor(u.id);
                                setPwdValue("");
                              }}
                            >
                              <KeyRound className="size-3.5 ml-1" /> كلمة المرور
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                if (confirm(`حذف ${u.email}؟`)) delMut.mutate(u.id);
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          لا يوجد مستخدمون
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={!!pwdFor} onOpenChange={(o) => !o && setPwdFor(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>تغيير كلمة المرور</DialogTitle>
              <DialogDescription>
                {users?.find((u: any) => u.id === pwdFor)?.email}
              </DialogDescription>
            </DialogHeader>
            <Input
              type="password"
              placeholder="كلمة مرور جديدة"
              value={pwdValue}
              onChange={(e) => setPwdValue(e.target.value)}
            />
            <DialogFooter>
              <Button
                onClick={() => pwdMut.mutate()}
                disabled={pwdValue.length < 6 || pwdMut.isPending}
              >
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
