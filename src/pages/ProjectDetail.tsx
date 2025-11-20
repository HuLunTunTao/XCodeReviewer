import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Edit, 
  ExternalLink,
  Code,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  FileText
} from "lucide-react";
import { api } from "@/shared/config/database";
import { runRepositoryAudit, scanZipFile } from "@/features/projects/services";
import type { Project, AuditTask, CreateProjectForm, AuditIssue } from "@/shared/types";
import { loadZipFile } from "@/shared/utils/zipStorage";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import TerminalProgressDialog from "@/components/audit/TerminalProgressDialog";
import { AuditTaskActions } from "@/components/audit/AuditTaskActions";
import { SUPPORTED_LANGUAGES } from "@/shared/constants";
import { buildAuditTaskName, getAuditTaskDisplayName } from "@/shared/utils/taskName";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showTerminalDialog, setShowTerminalDialog] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showQuickNameDialog, setShowQuickNameDialog] = useState(false);
  const [quickTaskName, setQuickTaskName] = useState("");
  const [quickTaskTags, setQuickTaskTags] = useState<string[]>([]);
  const [editForm, setEditForm] = useState<CreateProjectForm>({
    name: "",
    description: "",
    repository_url: "",
    repository_type: "github",
    default_branch: "main",
    programming_languages: []
  });

  // 将小写语言名转换为显示格式
  const formatLanguageName = (lang: string): string => {
    const nameMap: Record<string, string> = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'python': 'Python',
      'java': 'Java',
      'go': 'Go',
      'rust': 'Rust',
      'cpp': 'C++',
      'csharp': 'C#',
      'php': 'PHP',
      'ruby': 'Ruby',
      'swift': 'Swift',
      'kotlin': 'Kotlin'
    };
    return nameMap[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
  };

  const supportedLanguages = SUPPORTED_LANGUAGES.map(formatLanguageName);

  useEffect(() => {
    if (id) {
      loadProjectData();
    }
  }, [id]);

  const loadProjectData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const [projectData, tasksData] = await Promise.all([
        api.getProjectById(id),
        api.getAuditTasks(id)
      ]);
      
      setProject(projectData);
      setTasks(tasksData);
    } catch (error) {
      console.error('Failed to load project data:', error);
      toast.error("加载项目数据失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRunAudit = () => {
    if (!project) return;
    setQuickTaskName(buildAuditTaskName(project.name));
    setQuickTaskTags([]);
    setShowQuickNameDialog(true);
  };

  const executeAuditTask = async (taskName: string, tags: string[] = []) => {
    if (!project || !id) return;
    
    // 检查是否有仓库地址
    if (project.repository_url) {
      // 有仓库地址，启动仓库审计
      try {
        setScanning(true);
        console.log('开始启动仓库审计任务...');
        const taskId = await runRepositoryAudit({
          projectId: id,
          taskName,
          repoUrl: project.repository_url,
          branch: project.default_branch || 'main',
          scanConfig: {
            include_tests: true,
            include_docs: false,
            analysis_depth: 'standard',
            check_design_patterns: true
          },
          githubToken: undefined,
          gitlabToken: undefined,
          createdBy: undefined,
          tags
        });
        
        console.log('审计任务创建成功，taskId:', taskId);
        
        // 显示终端进度窗口
        setCurrentTaskId(taskId);
        setShowTerminalDialog(true);
        
        // 重新加载项目数据
        loadProjectData();
      } catch (e: any) {
        console.error('启动审计失败:', e);
        toast.error(e?.message || '启动审计失败');
      } finally {
        setScanning(false);
      }
    } else {
      // 没有仓库地址，尝试从IndexedDB加载保存的ZIP文件
      try {
        setScanning(true);
        const file = await loadZipFile(id);
        
        if (file) {
          console.log('找到保存的ZIP文件，开始启动审计...');
          try {
            // 启动ZIP文件审计
            const taskId = await scanZipFile({
              projectId: id,
              taskName,
              zipFile: file,
              excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
              createdBy: 'local-user',
              tags
            });
            
            console.log('审计任务创建成功，taskId:', taskId);
            
            // 显示终端进度窗口
            setCurrentTaskId(taskId);
            setShowTerminalDialog(true);
            
            // 重新加载项目数据
            loadProjectData();
          } catch (e: any) {
            console.error('启动审计失败:', e);
            toast.error(e?.message || '启动审计失败');
          } finally {
            setScanning(false);
          }
        } else {
          setScanning(false);
          toast.warning('此项目未配置仓库地址，也未上传ZIP文件。请先在项目设置中配置仓库地址，或通过\"新建任务\"上传ZIP文件。');
          // 不自动打开对话框，让用户自己选择
        }
      } catch (error) {
        console.error('启动审计失败:', error);
        setScanning(false);
        toast.error('读取ZIP文件失败，请检查项目配置');
      }
    }
  };

  const handleConfirmQuickTask = async () => {
    const trimmed = quickTaskName.trim();
    if (!trimmed) {
      toast.error("请输入任务名称");
      return;
    }
    setShowQuickNameDialog(false);
    await executeAuditTask(trimmed, quickTaskTags);
  };

  const handleOpenSettings = () => {
    if (!project) return;
    
    // 初始化编辑表单
    setEditForm({
      name: project.name,
      description: project.description || "",
      repository_url: project.repository_url || "",
      repository_type: project.repository_type || "github",
      default_branch: project.default_branch || "main",
      programming_languages: project.programming_languages ? JSON.parse(project.programming_languages) : []
    });
    
    setShowSettingsDialog(true);
  };

  const handleSaveSettings = async () => {
    if (!id) return;
    
    if (!editForm.name.trim()) {
      toast.error("项目名称不能为空");
      return;
    }

    try {
      await api.updateProject(id, editForm);
      toast.success("项目信息已保存");
      setShowSettingsDialog(false);
      loadProjectData();
    } catch (error) {
      console.error('Failed to update project:', error);
      toast.error("保存失败");
    }
  };

  const handleToggleLanguage = (lang: string) => {
    const currentLanguages = editForm.programming_languages || [];
    const newLanguages = currentLanguages.includes(lang)
      ? currentLanguages.filter(l => l !== lang)
      : [...currentLanguages, lang];
    
    setEditForm({ ...editForm, programming_languages: newLanguages });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Activity className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCreateTask = () => {
    setShowCreateTaskDialog(true);
  };

  const handleTaskCreated = () => {
    toast.success("审计任务已创建", {
      description: '因为网络和代码文件大小等因素，审计时长通常至少需要1分钟，请耐心等待...',
      duration: 5000
    });
    loadProjectData(); // 重新加载项目数据以显示新任务
  };

  const handleTaskRenamed = (updatedTask: AuditTask) => {
    setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
  };

  const handleTaskDeleted = (taskId: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">项目未找到</h2>
          <p className="text-gray-600 mb-4">请检查项目ID是否正确</p>
          <Link to="/projects">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回项目列表
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/projects">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600 mt-1">
              {project.description || '暂无项目描述'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Badge variant={project.is_active ? "default" : "secondary"}>
            {project.is_active ? '活跃' : '暂停'}
          </Badge>
          <Button onClick={handleRunAudit} disabled={scanning}>
            <Shield className="w-4 h-4 mr-2" />
            {scanning ? '正在启动...' : '启动审计'}
          </Button>
          <Button variant="outline" onClick={handleOpenSettings}>
            <Edit className="w-4 h-4 mr-2" />
            编辑
          </Button>
        </div>
      </div>

      {/* 项目概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">审计任务</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">已完成</p>
                <p className="text-2xl font-bold">
                  {tasks.filter(t => t.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">发现问题</p>
                <p className="text-2xl font-bold">
                  {tasks.reduce((sum, task) => sum + task.issues_count, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Code className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">平均质量分</p>
                <p className="text-2xl font-bold">
                  {tasks.length > 0 
                    ? (tasks.reduce((sum, task) => sum + task.quality_score, 0) / tasks.length).toFixed(1)
                    : '0.0'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容 */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">项目概览</TabsTrigger>
          <TabsTrigger value="tasks">审计任务</TabsTrigger>
          <TabsTrigger value="issues">问题管理</TabsTrigger>
          <TabsTrigger value="settings">项目设置</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 项目信息 */}
            <Card>
              <CardHeader>
                <CardTitle>项目信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {project.repository_url && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">仓库地址</span>
                      <a 
                        href={project.repository_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center"
                      >
                        查看仓库
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">仓库类型</span>
                    <Badge variant="outline">
                      {project.repository_type === 'github' ? 'GitHub' : 
                       project.repository_type === 'gitlab' ? 'GitLab' : '其他'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">默认分支</span>
                    <span className="text-sm text-muted-foreground">{project.default_branch}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">创建时间</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(project.created_at)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">所有者</span>
                    <span className="text-sm text-muted-foreground">
                      {project.owner?.full_name || project.owner?.phone || '未知'}
                    </span>
                  </div>
                </div>

                {/* 编程语言 */}
                {project.programming_languages && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">支持的编程语言</h4>
                    <div className="flex flex-wrap gap-2">
                      {JSON.parse(project.programming_languages).map((lang: string) => (
                        <Badge key={lang} variant="outline">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 最近活动 */}
            <Card>
              <CardHeader>
                <CardTitle>最近活动</CardTitle>
              </CardHeader>
              <CardContent>
                {tasks.length > 0 ? (
                  <div className="space-y-3">
                    {tasks.slice(0, 5).map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(task.status)}
                          <div>
                            <p className="text-sm font-medium">
                              {task.task_type === 'repository' ? '仓库审计' : '即时分析'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(task.created_at)}
                            </p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status === 'completed' ? '已完成' : 
                           task.status === 'running' ? '运行中' : 
                           task.status === 'failed' ? '失败' : '等待中'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">暂无活动记录</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">审计任务列表</h3>
            <Button onClick={handleCreateTask}>
              <Play className="w-4 h-4 mr-2" />
              新建任务
            </Button>
          </div>

          {tasks.length > 0 ? (
            <div className="space-y-4">
              {tasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4 gap-4">
                      <div className="flex items-start space-x-3">
                        {getStatusIcon(task.status)}
                        <div>
                          <h4 className="text-xl font-semibold text-gray-900">
                            {getAuditTaskDisplayName(task, project.name)}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {task.project?.name || project.name} · {task.task_type === 'repository' ? '仓库审计任务' : '即时分析任务'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            创建于 {formatDate(task.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(task.status)}>
                          {task.status === 'completed' ? '已完成' : 
                           task.status === 'running' ? '运行中' : 
                           task.status === 'failed' ? '失败' : '等待中'}
                        </Badge>
                        <AuditTaskActions
                          task={task}
                          onRenamed={handleTaskRenamed}
                          onDeleted={handleTaskDeleted}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{task.total_files}</p>
                        <p className="text-sm text-muted-foreground">总文件数</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{task.total_lines}</p>
                        <p className="text-sm text-muted-foreground">代码行数</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{task.issues_count}</p>
                        <p className="text-sm text-muted-foreground">发现问题</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{task.quality_score.toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">质量评分</p>
                      </div>
                    </div>

                    {task.status === 'completed' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>质量评分</span>
                          <span>{task.quality_score.toFixed(1)}/100</span>
                        </div>
                        <Progress value={task.quality_score} />
                      </div>
                    )}

                    <div className="flex justify-end space-x-2 mt-4">
                      <Link to={`/tasks/${task.id}`}>
                        <Button variant="outline" size="sm">
                          <FileText className="w-4 h-4 mr-2" />
                          查看详情
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">暂无审计任务</h3>
                <p className="text-sm text-muted-foreground mb-4">创建第一个审计任务开始代码质量分析</p>
                <Button onClick={handleCreateTask}>
                  <Play className="w-4 h-4 mr-2" />
                  创建任务
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="issues" className="space-y-6">
          <ProjectIssues projectId={id!} tasks={tasks} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="text-center py-12">
            <Edit className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">项目编辑</h3>
            <p className="text-sm text-muted-foreground">此功能正在开发中</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* 创建任务对话框 */}
      <CreateTaskDialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        onTaskCreated={handleTaskCreated}
        preselectedProjectId={id}
      />

      {/* 终端进度对话框 */}
      <TerminalProgressDialog
        open={showTerminalDialog}
        onOpenChange={setShowTerminalDialog}
        taskId={currentTaskId}
        taskType="repository"
      />

      {/* 快速任务命名对话框 */}
      <Dialog open={showQuickNameDialog} onOpenChange={setShowQuickNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>启动审计任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="quick-task-name">任务名称</Label>
            <Input
              id="quick-task-name"
              value={quickTaskName}
              onChange={(e) => setQuickTaskName(e.target.value)}
              placeholder={project ? buildAuditTaskName(project.name) : '请输入任务名称'}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              将显示在审计任务列表中，建议包含项目与时间信息方便识别
            </p>
            <div className="space-y-2 pt-4">
              <Label>任务标签</Label>
              <TagInput
                value={quickTaskTags}
                onChange={setQuickTaskTags}
                placeholder="输入标签后按 Enter，可留空"
              />
              <p className="text-xs text-muted-foreground">用于任务筛选，可留空</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickNameDialog(false)} disabled={scanning}>
              取消
            </Button>
            <Button onClick={handleConfirmQuickTask} disabled={scanning}>
              {scanning ? '启动中...' : '开始审计'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 项目编辑对话框 */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 基本信息 */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">项目名称 *</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="输入项目名称"
                />
              </div>

              <div>
                <Label htmlFor="edit-description">项目描述</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="输入项目描述"
                  rows={3}
                />
              </div>
            </div>

            {/* 仓库信息 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">仓库信息</h3>
              
              <div>
                <Label htmlFor="edit-repo-url">仓库地址</Label>
                <Input
                  id="edit-repo-url"
                  value={editForm.repository_url}
                  onChange={(e) => setEditForm({ ...editForm, repository_url: e.target.value })}
                  placeholder="https://github.com/username/repo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-repo-type">仓库类型</Label>
                  <Select
                    value={editForm.repository_type}
                    onValueChange={(value: any) => setEditForm({ ...editForm, repository_type: value })}
                  >
                    <SelectTrigger id="edit-repo-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="github">GitHub</SelectItem>
                      <SelectItem value="gitlab">GitLab</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-branch">默认分支</Label>
                  <Input
                    id="edit-branch"
                    value={editForm.default_branch}
                    onChange={(e) => setEditForm({ ...editForm, default_branch: e.target.value })}
                    placeholder="main"
                  />
                </div>
              </div>
            </div>

            {/* 编程语言 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">编程语言</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {supportedLanguages.map((lang) => (
                  <div
                    key={lang}
                    className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      editForm.programming_languages?.includes(lang)
                        ? 'border-primary bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleToggleLanguage(lang)}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        editForm.programming_languages?.includes(lang)
                          ? 'bg-primary border-primary'
                          : 'border-gray-300'
                      }`}
                    >
                      {editForm.programming_languages?.includes(lang) && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{lang}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveSettings}>
              保存修改
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectIssues({ projectId, tasks }: { projectId: string; tasks: AuditTask[] }) {
  const [loading, setLoading] = useState(false);
  const [issuesByTask, setIssuesByTask] = useState<Record<string, AuditIssue[]>>({});
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const loadIssues = async () => {
      try {
        setLoading(true);
        const entries = await Promise.all(tasks.map(async (t) => {
          try {
            const issues = await api.getAuditIssues(t.id);
            return [t.id, issues] as const;
          } catch {
            return [t.id, []] as const;
          }
        }));
        setIssuesByTask(Object.fromEntries(entries));
      } catch (e) {
        console.error('加载项目问题失败:', e);
      } finally {
        setLoading(false);
      }
    };
    if (tasks.length > 0) loadIssues();
  }, [projectId, tasks.map(t => t.id + ':' + t.issues_count).join(',')]);

  const toggleResolve = async (taskId: string, issue: AuditIssue) => {
    try {
      const target = issue.status === 'resolved' ? 'open' : 'resolved';
      await api.updateAuditIssue(issue.id, {
        status: target,
        resolved_by: target === 'resolved' ? 'local-user' : undefined,
        resolved_at: target === 'resolved' ? new Date().toISOString() : undefined,
      });
      const updated = await api.getAuditIssues(taskId);
      setIssuesByTask(prev => ({ ...prev, [taskId]: updated }));
      toast.success(target === 'resolved' ? '问题已标记为已解决' : '问题已标记为未解决');
    } catch (e) {
      console.error('更新问题状态失败:', e);
      toast.error('更新问题状态失败');
    }
  };

  const markAllResolved = async (taskId: string) => {
    try {
      const issues = await api.getAuditIssues(taskId);
      const toResolve = issues.filter(i => i.status !== 'resolved');
      await Promise.all(toResolve.map(i => api.updateAuditIssue(i.id, { status: 'resolved', resolved_by: 'local-user', resolved_at: new Date().toISOString() })));
      const updated = await api.getAuditIssues(taskId);
      setIssuesByTask(prev => ({ ...prev, [taskId]: updated }));
      toast.success('已将该任务所有问题标记为已解决');
    } catch (e) {
      console.error('批量标记问题失败:', e);
      toast.error('批量标记问题失败');
    }
  };

  const renderIssueRow = (taskId: string, issue: AuditIssue) => (
    <div key={issue.id} className="flex items-center justify-between p-3 border rounded-lg">
      <div className="space-y-1">
        <div className="text-sm font-medium">{issue.title}</div>
        <div className="text-xs text-gray-500">{issue.file_path}{issue.line_number ? ` · 第 ${issue.line_number} 行` : ''}</div>
        <div className="text-xs">严重性：{issue.severity} · 状态：{issue.status === 'resolved' ? '已解决' : '未解决'}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => toggleResolve(taskId, issue)}>
          {issue.status === 'resolved' ? '标记未解决' : '标记已解决'}
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return <div className="text-center py-12">加载问题中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>筛选状态</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="open">未解决</SelectItem>
              <SelectItem value="resolved">已解决</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {tasks.map(task => {
        const issues = (issuesByTask[task.id] || []).filter(i => filterStatus === 'all' ? true : i.status === filterStatus);
        const counts = {
          total: (issuesByTask[task.id] || []).length,
          resolved: (issuesByTask[task.id] || []).filter(i => i.status === 'resolved').length,
        };
        return (
          <Card key={task.id} className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{getAuditTaskDisplayName(task)}</span>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span>已解决 {counts.resolved}/{counts.total}</span>
                  {counts.total > 0 && counts.resolved < counts.total && (
                    <Button size="sm" variant="outline" onClick={() => markAllResolved(task.id)}>一键标记已解决</Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {issues.length > 0 ? issues.map(issue => renderIssueRow(task.id, issue)) : (
                <div className="text-sm text-gray-500">暂无问题</div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
