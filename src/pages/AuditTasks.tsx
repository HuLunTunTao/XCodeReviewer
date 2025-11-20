import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Search,
  FileText,
  Calendar,
  Plus
} from "lucide-react";
import { api } from "@/shared/config/database";
import type { AuditTask } from "@/shared/types";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import { calculateTaskProgress } from "@/shared/utils/utils";
import { AuditTaskActions } from "@/components/audit/AuditTaskActions";
import { getAuditTaskDisplayName } from "@/shared/utils/taskName";
import { TagInput } from "@/components/ui/tag-input";

const languageLabelMap: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  go: "Go",
  rust: "Rust",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  php: "PHP",
  ruby: "Ruby",
  swift: "Swift",
  kotlin: "Kotlin",
  dart: "Dart",
  objectivec: "Objective-C",
  objectivecpp: "Objective-C++",
  gdscript: "GDScript",
  scala: "Scala",
  perl: "Perl",
  haskell: "Haskell",
  lua: "Lua",
  erlang: "Erlang"
};

const formatLanguageLabel = (lang: string) => {
  const normalized = (lang || '').toLowerCase();
  return languageLabelMap[normalized] || (normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '');
};

const parseStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter((item): item is string => !!item);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => (typeof item === 'string' ? item.trim() : ''))
          .filter((item): item is string => !!item);
      }
    } catch {
      return trimmed
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }
  }
  return [];
};

const parseScanConfig = (config: AuditTask['scan_config']): Record<string, unknown> => {
  if (!config) return {};
  if (typeof config === 'string') {
    try {
      return JSON.parse(config) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (config || {}) as Record<string, unknown>;
};

const getTaskTags = (task: AuditTask): string[] => {
  const directTags = parseStringArray(task.tags);
  if (directTags.length > 0) {
    return directTags;
  }
  const config = parseScanConfig(task.scan_config);
  const tagsFromConfig = config['tags'];
  if (tagsFromConfig) {
    return parseStringArray(tagsFromConfig);
  }
  return [];
};

const getTaskLanguages = (task: AuditTask): string[] => {
  const languages = new Set<string>();
  parseStringArray(task.project?.programming_languages).forEach(lang => {
    languages.add(lang.toLowerCase());
  });

  const config = parseScanConfig(task.scan_config);
  const overrides = config['language_overrides'];
  if (Array.isArray(overrides)) {
    overrides.forEach(lang => {
      if (typeof lang === 'string') {
        languages.add(lang.toLowerCase());
      }
    });
  }

  const primaryLanguage = config['language'];
  if (typeof primaryLanguage === 'string') {
    languages.add(primaryLanguage.toLowerCase());
  }

  const fallbackLanguage = config['language_override'];
  if (typeof fallbackLanguage === 'string') {
    languages.add(fallbackLanguage.toLowerCase());
  }

  return Array.from(languages).filter(Boolean);
};

export default function AuditTasks() {
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tagFilters, setTagFilters] = useState<string[]>([]);

  useEffect(() => {
    loadTasks();
  }, []);

  // 静默更新活动任务的进度（不触发loading状态）
  useEffect(() => {
    const activeTasks = tasks.filter(
      task => task.status === 'running' || task.status === 'pending'
    );

    if (activeTasks.length === 0) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        // 只获取活动任务的最新数据
        const updatedData = await api.getAuditTasks();
        
        // 使用函数式更新，确保基于最新状态
        setTasks(prevTasks => {
          return prevTasks.map(prevTask => {
            const updated = updatedData.find(t => t.id === prevTask.id);
            // 只有在进度、状态或问题数真正变化时才更新
            if (updated && (
              updated.status !== prevTask.status ||
              updated.scanned_files !== prevTask.scanned_files ||
              updated.issues_count !== prevTask.issues_count
            )) {
              return updated;
            }
            return prevTask;
          });
        });
      } catch (error) {
        console.error('静默更新任务列表失败:', error);
      }
    }, 3000); // 每3秒静默更新一次

    return () => clearInterval(intervalId);
  }, [tasks.map(t => t.id + t.status).join(',')]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditTasks();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error("加载任务失败");
    } finally {
      setLoading(false);
    }
  };

  const handleTaskRenamed = (updatedTask: AuditTask) => {
    setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
  };

  const handleTaskDeleted = (taskId: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-red-50 text-red-800';
      case 'failed': return 'bg-red-100 text-red-900';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Activity className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      case 'cancelled': return <Clock className="w-4 h-4" />;
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

  const availableProjects = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach(task => {
      if (task.project?.id) {
        const name = task.project.name || '未命名项目';
        if (name !== '即时代码分析') {
          map.set(task.project.id, name);
        }
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [tasks]);

  const availableLanguages = useMemo(() => {
    const langSet = new Set<string>();
    tasks.forEach(task => {
      getTaskLanguages(task).forEach(lang => langSet.add(lang));
    });
    return Array.from(langSet).sort((a, b) => formatLanguageLabel(a).localeCompare(formatLanguageLabel(b), 'zh-CN'));
  }, [tasks]);

  const availableTagOptions = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    tasks.forEach(task => {
      getTaskTags(task).forEach(tag => {
        const normalized = tag.toLowerCase();
        const existing = map.get(normalized);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(normalized, { label: tag, count: 1 });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [tasks]);

  const handleAddFilterTag = (tag: string) => {
    setTagFilters(prev => {
      const normalized = tag.toLowerCase();
      const exists = prev.some(existing => existing.toLowerCase() === normalized);
      if (exists) return prev;
      return [...prev, tag];
    });
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setProjectFilter("all");
    setLanguageFilter("all");
    setStartDate("");
    setEndDate("");
    setTagFilters([]);
  };

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      searchTerm.trim() ||
      statusFilter !== "all" ||
      projectFilter !== "all" ||
      languageFilter !== "all" ||
      startDate ||
      endDate ||
      tagFilters.length > 0
    );
  }, [searchTerm, statusFilter, projectFilter, languageFilter, startDate, endDate, tagFilters]);

  const keyword = searchTerm.trim().toLowerCase();
  const parsedStart = startDate ? new Date(`${startDate}T00:00:00`).getTime() : NaN;
  const parsedEnd = endDate ? new Date(`${endDate}T23:59:59`).getTime() : NaN;
  const startTimestamp = Number.isNaN(parsedStart) ? null : parsedStart;
  const endTimestamp = Number.isNaN(parsedEnd) ? null : parsedEnd;
  const normalizedTagFilters = tagFilters.map(tag => tag.toLowerCase());
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !keyword ||
      getAuditTaskDisplayName(task).toLowerCase().includes(keyword) ||
      (task.project?.name || '').toLowerCase().includes(keyword) ||
      task.task_type.toLowerCase().includes(keyword);
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesProject = (() => {
      if (projectFilter === 'all') return true;
      if (projectFilter === 'instant') return task.task_type === 'instant';
      return task.project?.id === projectFilter && task.task_type !== 'instant';
    })();
    const createdTime = new Date(task.created_at).getTime();
    const matchesStartDate = !startTimestamp || createdTime >= startTimestamp;
    const matchesEndDate = !endTimestamp || createdTime <= endTimestamp;
    const languages = getTaskLanguages(task);
    const matchesLanguage = languageFilter === "all" || languages.includes(languageFilter);
    const taskTagValues = getTaskTags(task).map(tag => tag.toLowerCase());
    const matchesTags = normalizedTagFilters.length === 0 || normalizedTagFilters.every(tag => taskTagValues.includes(tag));
    return matchesSearch && matchesStatus && matchesProject && matchesStartDate && matchesEndDate && matchesLanguage && matchesTags;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">审计任务</h1>
          <p className="page-subtitle">查看和管理所有代码审计任务的执行状态</p>
        </div>
        <Button className="btn-primary" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          新建任务
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">总任务数</p>
                <p className="stat-value text-xl">{tasks.length}</p>
              </div>
              <div className="stat-icon from-primary to-accent">
                <Activity className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">已完成</p>
                <p className="stat-value text-xl">{tasks.filter(t => t.status === 'completed').length}</p>
              </div>
              <div className="stat-icon from-emerald-500 to-emerald-600">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">运行中</p>
                <p className="stat-value text-xl">{tasks.filter(t => t.status === 'running').length}</p>
              </div>
              <div className="stat-icon from-orange-500 to-orange-600">
                <Clock className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">失败</p>
                <p className="stat-value text-xl">{tasks.filter(t => t.status === 'failed').length}</p>
              </div>
              <div className="stat-icon from-red-500 to-red-600">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索项目名称或任务类型..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                全部
              </Button>
              <Button
                variant={statusFilter === "running" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("running")}
              >
                运行中
              </Button>
              <Button
                variant={statusFilter === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("completed")}
              >
                已完成
              </Button>
              <Button
                variant={statusFilter === "failed" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("failed")}
              >
                失败
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>项目</Label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="全部项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部项目</SelectItem>
                  <SelectItem value="instant">即时代码分析</SelectItem>
                  <SelectItem value="__sep__" disabled>---</SelectItem>
                  {availableProjects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>语言</Label>
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="全部语言" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部语言</SelectItem>
                  {availableLanguages.map(lang => (
                    <SelectItem key={lang} value={lang}>
                      {formatLanguageLabel(lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>开始日期</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>结束日期</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>标签筛选</Label>
            <TagInput
              value={tagFilters}
              onChange={setTagFilters}
              placeholder="输入标签后按 Enter，支持多个"
            />
            {availableTagOptions.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                <span>常用：</span>
                {availableTagOptions.slice(0, 6).map((tag) => (
                  <button
                    type="button"
                    key={tag.label}
                    onClick={() => handleAddFilterTag(tag.label)}
                    className="rounded-full border border-dashed border-primary/30 px-3 py-1 text-primary transition hover:border-primary hover:bg-primary/5"
                  >
                    #{tag.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleResetFilters} disabled={!hasActiveFilters}>
              重置筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 任务列表 */}
      {filteredTasks.length > 0 ? (
        <div className="space-y-4">
          {filteredTasks.map((task) => {
            const taskTags = getTaskTags(task);
            const taskLanguages = getTaskLanguages(task);
            return (
              <Card key={task.id} className="card-modern group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-6 gap-4">
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      task.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                      task.status === 'running' ? 'bg-red-50 text-red-600' :
                      task.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {getStatusIcon(task.status)}
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold text-gray-900 group-hover:text-primary transition-colors">
                        {getAuditTaskDisplayName(task)}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {task.task_type === 'instant' ? '即时分析任务' : `${task.project?.name || '未知项目'} · 仓库审计任务`}
                      </p>
                      {(taskLanguages.length > 0 || taskTags.length > 0) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {taskLanguages.map((lang) => (
                            <Badge key={`${task.id}-lang-${lang}`} variant="secondary" className="bg-slate-100 text-slate-600">
                              {formatLanguageLabel(lang)}
                            </Badge>
                          ))}
                          {taskTags.map((tag) => (
                            <Badge key={`${task.id}-tag-${tag}`} variant="outline" className="border-primary/30 text-primary">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        创建于 {formatDate(task.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(task.status)}>
                      {task.status === 'completed' ? '已完成' : 
                       task.status === 'running' ? '运行中' : 
                       task.status === 'failed' ? '失败' :
                       task.status === 'cancelled' ? '已取消' : '等待中'}
                    </Badge>
                    <AuditTaskActions
                      task={task}
                      onRenamed={handleTaskRenamed}
                      onDeleted={handleTaskDeleted}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100/30 rounded-xl border border-blue-200">
                    <div className="text-2xl font-bold text-blue-600 mb-1">{task.total_files}</div>
                    <p className="text-xs text-blue-700 font-medium">文件数</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100/30 rounded-xl border border-purple-200">
                    <div className="text-2xl font-bold text-purple-600 mb-1">{task.total_lines.toLocaleString()}</div>
                    <p className="text-xs text-purple-700 font-medium">代码行数</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100/30 rounded-xl border border-orange-200">
                    <div className="text-2xl font-bold text-orange-600 mb-1">{task.issues_count}</div>
                    <p className="text-xs text-orange-700 font-medium">发现问题</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100/30 rounded-xl border border-green-200">
                    <div className="text-2xl font-bold text-green-600 mb-1">{task.quality_score.toFixed(1)}</div>
                    <p className="text-xs text-green-700 font-medium">质量评分</p>
                  </div>
                </div>

                {/* 扫描进度 */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">扫描进度</span>
                    <span className="text-sm text-gray-500">
                      {task.scanned_files || 0} / {task.total_files || 0} 文件
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all duration-300"
                      style={{ width: `${calculateTaskProgress(task.scanned_files, task.total_files)}%` }}
                    ></div>
                  </div>
                  <div className="text-right mt-1">
                    <span className="text-xs text-gray-500">
                      {calculateTaskProgress(task.scanned_files, task.total_files)}% 完成
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDate(task.created_at)}
                    </div>
                    {task.completed_at && (
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {formatDate(task.completed_at)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <Link to={`/tasks/${task.id}`}>
                      <Button variant="outline" size="sm" className="btn-secondary">
                        <FileText className="w-4 h-4 mr-2" />
                        查看详情
                      </Button>
                    </Link>
                    {task.project && task.task_type !== 'instant' && (
                      <Link to={`/projects/${task.project.id}`}>
                        <Button size="sm" className="btn-primary">
                          查看项目
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="card-modern">
          <CardContent className="empty-state py-16">
            <div className="empty-icon">
              <Activity className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== "all" ? '未找到匹配的任务' : '暂无审计任务'}
            </h3>
            <p className="text-gray-500 mb-6 max-w-md">
              {searchTerm || statusFilter !== "all" ? '尝试调整搜索条件或筛选器' : '创建第一个审计任务开始代码质量分析'}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Button className="btn-primary" onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                创建任务
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* 新建任务对话框 */}
      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onTaskCreated={loadTasks}
      />
    </div>
  );
}
