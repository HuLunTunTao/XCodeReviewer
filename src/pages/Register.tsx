import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/shared/contexts/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.email || !form.password) {
      toast.error("请填写完整信息");
      return;
    }
    try {
      setLoading(true);
      await register(form);
      toast.success("注册成功，已自动登录");
      navigate("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "注册失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border border-white/60 backdrop-blur">
        <CardHeader className="text-center space-y-3">
          <div className="flex items-center justify-center">
            <img src="/images/logo/logo-icon.svg" alt="XCodeReviewer" className="w-12 h-12" />
          </div>
          <CardTitle className="text-2xl font-bold">创建账号</CardTitle>
          <CardDescription>注册后即可创建项目并发起多人协作审计</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium text-gray-700">姓名</label>
              <Input
                placeholder="您的称呼"
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">邮箱</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">密码</label>
              <Input
                type="password"
                placeholder="至少 8 位"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "注册中..." : "注册并登录"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            已有账号？{" "}
            <Link to="/login" className="text-primary hover:underline">
              立即登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
