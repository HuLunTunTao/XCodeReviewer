import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatabaseManager } from "@/components/database/DatabaseManager";
import { SystemConfig } from "@/components/system/SystemConfig";
import { api, dbMode } from "@/shared/config/database";
import { toast } from "sonner";
import { useAuth } from "@/shared/contexts/AuthContext";
import type { Profile } from "@/shared/types";
import {
  RefreshCw,
  Settings,
  FolderOpen,
  Clock,
  AlertTriangle,
  Database as DatabaseIcon,
} from "lucide-react";

interface StatsState {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  totalIssues: number;
  resolvedIssues: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsState>({
    totalProjects: 0,
    activeProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    totalIssues: 0,
    resolvedIssues: 0,
  });
  const [tables, setTables] = useState<Array<{ name: string; rows: number }>>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    loadStats();
    loadTables();
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      loadUsers();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const projectStats = await api.getProjectStats();
      setStats({
        totalProjects: projectStats.total_projects || 0,
        activeProjects: projectStats.active_projects || 0,
        totalTasks: projectStats.total_tasks || 0,
        completedTasks: projectStats.completed_tasks || 0,
        totalIssues: projectStats.total_issues || 0,
        resolvedIssues: projectStats.resolved_issues || 0,
      });
    } catch (error) {
      console.error("Failed to load stats:", error);
      toast.error("加载统计数据失败");
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async () => {
    try {
      setTablesLoading(true);
      const data = await api.getDatabaseTables();
      setTables(data);
    } catch (error) {
      console.error("Failed to load tables:", error);
      toast.error("加载数据库表信息失败");
    } finally {
      setTablesLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const data = await api.getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast.error("加载用户列表失败");
    } finally {
      setUsersLoading(false);
    }
  };

  const handleRoleChange = async (profile: Profile, nextRole: "admin" | "member") => {
    try {
      const updated = await api.updateUserRole(profile.id, nextRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(`已将 ${updated.full_name || updated.email} 设为 ${nextRole === "admin" ? "管理员" : "成员"}`);
    } catch (error) {
      console.error("Failed to update role:", error);
      toast.error("更新用户角色失败");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">加载系统数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            系统管理
          </h1>
          <p className="text-gray-600 mt-2">
            管理运行配置、用户权限以及服务器本地 SQLite 数据库
          </p>
        </div>
        <Button variant="outline" onClick={() => { loadStats(); loadTables(); if (user?.role === "admin") loadUsers(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新数据
        </Button>
      </div>

      <Alert>
        <AlertDescription>
          当前默认使用 <strong>服务器本地 SQLite</strong> 存储。数据库模式：<Badge variant="secondary">{dbMode}</Badge>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">项目总数</p>
                <p className="text-3xl font-bold mt-2">{stats.totalProjects}</p>
                <p className="text-xs text-muted-foreground mt-1">活跃 {stats.activeProjects}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <FolderOpen className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">审计任务</p>
                <p className="text-3xl font-bold mt-2">{stats.totalTasks}</p>
                <p className="text-xs text-muted-foreground mt-1">已完成 {stats.completedTasks}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">发现问题</p>
                <p className="text-3xl font-bold mt-2">{stats.totalIssues}</p>
                <p className="text-xs text-muted-foreground mt-1">已解决 {stats.resolvedIssues}</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">数据库</p>
                <p className="text-3xl font-bold mt-2 capitalize">SQLite</p>
                <p className="text-xs text-muted-foreground mt-1">模式：{dbMode}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <DatabaseIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config">系统配置</TabsTrigger>
          <TabsTrigger value="overview">数据概览</TabsTrigger>
          <TabsTrigger value="database">数据库表</TabsTrigger>
          <TabsTrigger value="users">用户管理</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <SystemConfig />
        </TabsContent>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>任务完成率</CardTitle>
                <CardDescription>审计执行效率</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>完成度</span>
                    <span className="font-medium">
                      {stats.totalTasks > 0
                        ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${stats.totalTasks > 0
                          ? (stats.completedTasks / stats.totalTasks) * 100
                          : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>问题解决率</CardTitle>
                <CardDescription>团队响应效率</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>解决率</span>
                    <span className="font-medium">
                      {stats.totalIssues > 0
                        ? Math.round((stats.resolvedIssues / stats.totalIssues) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{
                        width: `${stats.totalIssues > 0
                          ? (stats.resolvedIssues / stats.totalIssues) * 100
                          : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database">
          <DatabaseManager tables={tables} loading={tablesLoading} onRefresh={loadTables} />
        </TabsContent>

        <TabsContent value="users">
          {user?.role !== "admin" ? (
            <Alert>
              <AlertDescription>只有系统管理员可以查看用户管理界面</AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>系统用户</CardTitle>
                  <CardDescription>管理平台访问权限，支持多租户协作</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadUsers} disabled={usersLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${usersLoading ? "animate-spin" : ""}`} />
                  刷新
                </Button>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户</TableHead>
                      <TableHead>邮箱</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.full_name || "未命名"}</TableCell>
                        <TableCell>{profile.email}</TableCell>
                        <TableCell>
                          <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
                            {profile.role === "admin" ? "管理员" : "成员"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {profile.id === user.id ? (
                            <span className="text-xs text-muted-foreground">当前账号</span>
                          ) : (
                            <Select
                              defaultValue={profile.role}
                              onValueChange={(value) => handleRoleChange(profile, value as "admin" | "member")}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">成员</SelectItem>
                                <SelectItem value="admin">管理员</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          暂无用户数据
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
