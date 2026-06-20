import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signIn, signUp } from "@/lib/local-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wifi } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "تسجيل الدخول | Home Net" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(username, password);
      toast.success("مرحباً بعودتك!");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp({ username, password, full_name: fullName });
      toast.success("تم إنشاء الحساب بنجاح!");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/30 to-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="size-14 bg-primary rounded-2xl flex items-center justify-center ring-4 ring-primary/10 mb-4">
            <Wifi className="size-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Home Net</h1>
          <p className="text-sm text-muted-foreground mt-1">نظام محلي لإدارة راوترات مايكروتيك</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>أهلاً بك</CardTitle>
            <CardDescription>
              الافتراضي: <code className="font-mono">admin / admin</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">دخول</TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">حساب جديد</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>اسم المستخدم</Label>
                    <Input required value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" placeholder="admin" autoComplete="username" />
                  </div>
                  <div className="space-y-2">
                    <Label>كلمة المرور</Label>
                    <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "جارٍ الدخول..." : "تسجيل الدخول"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>الاسم الكامل</Label>
                    <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>اسم المستخدم</Label>
                    <Input required value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" placeholder="admin" autoComplete="username" />
                  </div>
                  <div className="space-y-2">
                    <Label>كلمة المرور</Label>
                    <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" autoComplete="new-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "جارٍ الإنشاء..." : "إنشاء حساب"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    أول حساب يتم إنشاؤه يصبح المدير الرئيسي للنظام
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
