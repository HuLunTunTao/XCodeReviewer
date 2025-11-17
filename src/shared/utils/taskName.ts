import type { AuditTask } from "@/shared/types";

/**
 * 根据项目名称生成默认的审计任务名称
 */
export function buildAuditTaskName(projectName?: string, now: Date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const prefix = projectName || "审计任务";
  return `${prefix} ${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日 ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * 获取任务名称的显示文本，兼容旧任务
 */
export function getAuditTaskDisplayName(task?: Pick<AuditTask, "name" | "project">, fallbackProjectName?: string) {
  if (task?.name && task.name.trim()) {
    return task.name;
  }
  const projectName = task?.project?.name || fallbackProjectName || "审计任务";
  return `${projectName} 审计任务`;
}
