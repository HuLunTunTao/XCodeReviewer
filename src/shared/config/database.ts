import { request } from "@/shared/api/http";
import type {
  Profile,
  Project,
  ProjectMember,
  AuditTask,
  AuditIssue,
  InstantAnalysis,
  CreateProjectForm,
  CreateAuditTaskForm,
  InstantAnalysisForm,
} from "../types";

export const dbMode = "server-sqlite";
export const isDemoMode = false;
export const isLocalMode = false;

type ProjectResponse = Project & { members?: ProjectMember[] };

const normalizeProject = (project: any): ProjectResponse => ({
  ...project,
  programming_languages: project?.programming_languages || "[]",
  members: project?.members || [],
});

const normalizeTask = (task: any): AuditTask => ({
  ...task,
  exclude_patterns:
    typeof task?.exclude_patterns === "string"
      ? task.exclude_patterns
      : JSON.stringify(task?.exclude_patterns || []),
  scan_config:
    typeof task?.scan_config === "string"
      ? task.scan_config
      : JSON.stringify(task?.scan_config || {}),
});

export const api = {
  async getProjects(): Promise<ProjectResponse[]> {
    const res = await request<{ projects: Project[] }>("/projects");
    return res.projects.map(normalizeProject);
  },

  async getProjectById(id: string): Promise<ProjectResponse | null> {
    if (!id) return null;
    const res = await request<{ project: Project }>(`/projects/${id}`);
    return normalizeProject(res.project);
  },

  async createProject(project: CreateProjectForm & { members?: Array<{ user_id: string; role: string }> }): Promise<ProjectResponse> {
    const res = await request<{ project: Project }>("/projects", {
      method: "POST",
      body: JSON.stringify(project),
    });
    return normalizeProject(res.project);
  },

  async updateProject(id: string, updates: Partial<CreateProjectForm>): Promise<ProjectResponse> {
    const res = await request<{ project: Project }>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return normalizeProject(res.project);
  },

  async deleteProject(id: string): Promise<void> {
    await request(`/projects/${id}`, { method: "DELETE" });
  },

  async getDeletedProjects(): Promise<ProjectResponse[]> {
    const res = await request<{ projects: Project[] }>("/projects/deleted");
    return res.projects.map(normalizeProject);
  },

  async restoreProject(id: string): Promise<void> {
    await request(`/projects/${id}/restore`, { method: "POST" });
  },

  async permanentlyDeleteProject(id: string): Promise<void> {
    await request(`/projects/${id}/permanent`, { method: "DELETE" });
  },

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const res = await request<{ members: ProjectMember[] }>(`/projects/${projectId}/members`);
    return res.members;
  },

  async addProjectMember(projectId: string, payload: { email: string; role: "manager" | "operator" }): Promise<ProjectMember[]> {
    const res = await request<{ members: ProjectMember[] }>(`/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return res.members;
  },

  async removeProjectMember(projectId: string, memberId: string): Promise<ProjectMember[]> {
    const res = await request<{ members: ProjectMember[] }>(`/projects/${projectId}/members/${memberId}`, {
      method: "DELETE",
    });
    return res.members;
  },

  async getAuditTasks(projectId?: string): Promise<AuditTask[]> {
    const query = projectId ? `?projectId=${projectId}` : "";
    const res = await request<{ tasks: AuditTask[] }>(`/audit-tasks${query}`);
    return res.tasks.map(normalizeTask);
  },

  async getAuditTaskById(id: string): Promise<AuditTask | null> {
    const res = await request<{ task: AuditTask }>(`/audit-tasks/${id}`);
    return normalizeTask(res.task);
  },

  async createAuditTask(task: CreateAuditTaskForm): Promise<AuditTask> {
    const res = await request<{ task: AuditTask }>("/audit-tasks", {
      method: "POST",
      body: JSON.stringify(task),
    });
    return normalizeTask(res.task);
  },

  async updateAuditTask(id: string, updates: Partial<AuditTask>): Promise<AuditTask> {
    const res = await request<{ task: AuditTask }>(`/audit-tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return normalizeTask(res.task);
  },

  async deleteAuditTask(id: string): Promise<void> {
    await request(`/audit-tasks/${id}`, { method: "DELETE" });
  },

  async getAuditIssues(taskId: string): Promise<AuditIssue[]> {
    const res = await request<{ issues: AuditIssue[] }>(`/audit-tasks/${taskId}/issues`);
    return res.issues;
  },

  async createAuditIssue(issue: Omit<AuditIssue, "id" | "created_at" | "task" | "resolver">): Promise<AuditIssue> {
    const res = await request<{ issue: AuditIssue }>(`/audit-tasks/${issue.task_id}/issues`, {
      method: "POST",
      body: JSON.stringify(issue),
    });
    return res.issue;
  },

  async updateAuditIssue(id: string, updates: Partial<AuditIssue>): Promise<AuditIssue> {
    const res = await request<{ issue: AuditIssue }>(`/audit-tasks/issues/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return res.issue;
  },

  async createInstantAnalysis(analysis: InstantAnalysisForm & { 
    user_id?: string;
    analysis_result?: any;
    issues_count?: number;
    quality_score?: number;
    analysis_time?: number;
  }): Promise<InstantAnalysis> {
    const res = await request<{ analysis: InstantAnalysis }>("/instant-analyses", {
      method: "POST",
      body: JSON.stringify(analysis),
    });
    return res.analysis;
  },

  async getProjectStats(): Promise<any> {
    const res = await request<{ stats: any }>("/admin/stats");
    return res.stats;
  },

  async getDatabaseTables(): Promise<Array<{ name: string; rows: number }>> {
    const res = await request<{ tables: Array<{ name: string; rows: number }> }>("/admin/tables");
    return res.tables;
  },

  async getAllUsers(): Promise<Profile[]> {
    const res = await request<{ users: Profile[] }>("/users");
    return res.users;
  },

  async updateUserRole(userId: string, role: "admin" | "member"): Promise<Profile> {
    const res = await request<{ user: Profile }>(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    return res.user;
  },

  async getUserOptions(): Promise<Array<{ id: string; email: string; full_name?: string; role: string }>> {
    const res = await request<{ users: Array<{ id: string; email: string; full_name?: string; role: string }> }>("/users/options");
    return res.users;
  },
};
