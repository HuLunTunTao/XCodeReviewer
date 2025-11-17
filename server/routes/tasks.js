import { Router } from "express";
import { randomUUID } from "node:crypto";
import db from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

const profileFields = `
  id, email, full_name, phone, role, github_username, gitlab_username, avatar_url,
  created_at, updated_at
`;

function mapTask(row) {
  if (!row) return null;
  const project = {
    id: row.project_id,
    name: row.project_name,
    description: row.project_description,
    repository_url: row.project_repository_url,
    repository_type: row.project_repository_type,
    default_branch: row.project_default_branch,
    programming_languages: row.project_programming_languages || "[]",
    owner_id: row.project_owner_id,
    is_active: !!row.project_is_active,
    created_at: row.project_created_at,
    updated_at: row.project_updated_at,
  };
  const creator = row.creator_id
    ? {
        id: row.creator_id,
        email: row.creator_email,
        full_name: row.creator_full_name,
        role: row.creator_role,
      }
    : null;
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    task_type: row.task_type,
    status: row.status,
    branch_name: row.branch_name,
    exclude_patterns: row.exclude_patterns || "[]",
    scan_config: row.scan_config || "{}",
    total_files: row.total_files,
    scanned_files: row.scanned_files,
    total_lines: row.total_lines,
    issues_count: row.issues_count,
    quality_score: row.quality_score,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_by: row.created_by,
    created_at: row.created_at,
    project,
    creator,
  };
}

function userProjectRole(projectId, userId) {
  return db
    .prepare(`SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`)
    .get(projectId, userId)?.role;
}

function userHasTaskAccess(taskId, userId) {
  const task = db.prepare("SELECT project_id FROM audit_tasks WHERE id = ?").get(taskId);
  if (!task) return null;
  const role = userProjectRole(task.project_id, userId);
  if (!role) return null;
  return { role, projectId: task.project_id };
}

router.get("/", authenticate, (req, res) => {
  const { projectId } = req.query;
  const params = { userId: req.user.id, projectId };
  const rows = db
    .prepare(
      `SELECT t.*, 
        p.name as project_name,
        p.description as project_description,
        p.repository_url as project_repository_url,
        p.repository_type as project_repository_type,
        p.default_branch as project_default_branch,
        p.programming_languages as project_programming_languages,
        p.owner_id as project_owner_id,
        p.is_active as project_is_active,
        p.created_at as project_created_at,
        p.updated_at as project_updated_at,
        c.id as creator_id,
        c.email as creator_email,
        c.full_name as creator_full_name,
        c.role as creator_role
       FROM audit_tasks t
       JOIN projects p ON p.id = t.project_id
       JOIN project_members pm ON pm.project_id = p.id
       LEFT JOIN profiles c ON c.id = t.created_by
       WHERE pm.user_id = @userId
         ${projectId ? "AND t.project_id = @projectId" : ""}
       ORDER BY t.created_at DESC`
    )
    .all(params);
  res.json({ tasks: rows.map(mapTask) });
});

router.post("/", authenticate, (req, res) => {
  const {
    project_id,
    name,
    task_type,
    branch_name,
    exclude_patterns = [],
    scan_config = {},
  } = req.body;
  const role = userProjectRole(project_id, req.user.id);
  if (!role || (role !== "owner" && role !== "manager" && role !== "operator")) {
    return res.status(403).json({ message: "没有权限在该项目创建任务" });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO audit_tasks (
      id, project_id, name, task_type, status, branch_name,
      exclude_patterns, scan_config, created_by, created_at
    ) VALUES (
      @id, @project_id, @name, @task_type, 'pending', @branch_name,
      @exclude_patterns, @scan_config, @created_by, datetime('now')
    )`
  ).run({
    id,
    project_id,
    name: name || "未命名审计任务",
    task_type,
    branch_name: branch_name || null,
    exclude_patterns: JSON.stringify(exclude_patterns),
    scan_config: JSON.stringify(scan_config),
    created_by: req.user.id,
  });

  const taskRow = db
    .prepare(
      `SELECT t.*, 
        p.name as project_name,
        p.description as project_description,
        p.repository_url as project_repository_url,
        p.repository_type as project_repository_type,
        p.default_branch as project_default_branch,
        p.programming_languages as project_programming_languages,
        p.owner_id as project_owner_id,
        p.is_active as project_is_active,
        p.created_at as project_created_at,
        p.updated_at as project_updated_at,
        c.id as creator_id,
        c.email as creator_email,
        c.full_name as creator_full_name,
        c.role as creator_role
       FROM audit_tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN profiles c ON c.id = t.created_by
       WHERE t.id = ?`
    )
    .get(id);

  res.status(201).json({ task: mapTask(taskRow) });
});

router.put("/:id", authenticate, (req, res) => {
  const { id } = req.params;
  const access = userHasTaskAccess(id, req.user.id);
  if (!access) {
    return res.status(404).json({ message: "任务不存在或无权限访问" });
  }

  const updates = { ...req.body };
  if (updates.exclude_patterns && Array.isArray(updates.exclude_patterns)) {
    updates.exclude_patterns = JSON.stringify(updates.exclude_patterns);
  }
  if (updates.scan_config && typeof updates.scan_config === "object") {
    updates.scan_config = JSON.stringify(updates.scan_config);
  }

  const setClause = Object.keys(updates)
    .map((key) => `${key} = @${key}`)
    .join(", ");
  if (!setClause) {
    return res.status(400).json({ message: "没有需要更新的内容" });
  }

  db.prepare(`UPDATE audit_tasks SET ${setClause} WHERE id = @id`).run({
    ...updates,
    id,
  });

  const row = db
    .prepare(
      `SELECT t.*, 
        p.name as project_name,
        p.description as project_description,
        p.repository_url as project_repository_url,
        p.repository_type as project_repository_type,
        p.default_branch as project_default_branch,
        p.programming_languages as project_programming_languages,
        p.owner_id as project_owner_id,
        p.is_active as project_is_active,
        p.created_at as project_created_at,
        p.updated_at as project_updated_at,
        c.id as creator_id,
        c.email as creator_email,
        c.full_name as creator_full_name,
        c.role as creator_role
       FROM audit_tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN profiles c ON c.id = t.created_by
       WHERE t.id = ?`
    )
    .get(id);
  res.json({ task: mapTask(row) });
});

router.delete("/:id", authenticate, (req, res) => {
  const { id } = req.params;
  const access = userHasTaskAccess(id, req.user.id);
  if (!access) {
    return res.status(404).json({ message: "任务不存在或无权限访问" });
  }
  const task = db.prepare("SELECT * FROM audit_tasks WHERE id = ?").get(id);
  const project = db.prepare("SELECT owner_id FROM projects WHERE id = ?").get(task.project_id);
  if (task.created_by !== req.user.id && project.owner_id !== req.user.id) {
    return res.status(403).json({ message: "只有任务创建者或项目所有者可以删除任务" });
  }
  db.prepare("DELETE FROM audit_tasks WHERE id = ?").run(id);
  res.json({ success: true });
});

router.get("/:id/issues", authenticate, (req, res) => {
  const { id } = req.params;
  if (!userHasTaskAccess(id, req.user.id)) {
    return res.status(404).json({ message: "任务不存在或无权限访问" });
  }
  const issues = db
    .prepare(
      `SELECT ai.*, r.id as resolver_id, r.email as resolver_email, r.full_name as resolver_full_name
       FROM audit_issues ai
       LEFT JOIN profiles r ON r.id = ai.resolved_by
       WHERE ai.task_id = ?
       ORDER BY ai.created_at DESC`
    )
    .all(id)
    .map((issue) => ({
      ...issue,
      resolver: issue.resolver_id
        ? {
            id: issue.resolver_id,
            email: issue.resolver_email,
            full_name: issue.resolver_full_name,
          }
        : null,
    }));
  res.json({ issues });
});

router.post("/:id/issues", authenticate, (req, res) => {
  const { id } = req.params;
  if (!userHasTaskAccess(id, req.user.id)) {
    return res.status(404).json({ message: "任务不存在或无权限访问" });
  }
  const issueId = randomUUID();
  db.prepare(
    `INSERT INTO audit_issues (
      id, task_id, file_path, line_number, column_number, issue_type,
      severity, title, description, suggestion, code_snippet, ai_explanation,
      status, created_at
    ) VALUES (
      @id, @task_id, @file_path, @line_number, @column_number, @issue_type,
      @severity, @title, @description, @suggestion, @code_snippet, @ai_explanation,
      @status, datetime('now')
    )`
  ).run({
    id: issueId,
    task_id: id,
    file_path: req.body.file_path || "",
    line_number: req.body.line_number || null,
    column_number: req.body.column_number || null,
    issue_type: req.body.issue_type || "maintainability",
    severity: req.body.severity || "low",
    title: req.body.title || "未命名问题",
    description: req.body.description || "",
    suggestion: req.body.suggestion || "",
    code_snippet: req.body.code_snippet || "",
    ai_explanation: req.body.ai_explanation || "",
    status: req.body.status || "open",
  });
  const issue = db.prepare("SELECT * FROM audit_issues WHERE id = ?").get(issueId);
  res.status(201).json({ issue });
});

router.put("/issues/:issueId", authenticate, (req, res) => {
  const { issueId } = req.params;
  const issue = db.prepare("SELECT * FROM audit_issues WHERE id = ?").get(issueId);
  if (!issue) {
    return res.status(404).json({ message: "问题不存在" });
  }
  if (!userHasTaskAccess(issue.task_id, req.user.id)) {
    return res.status(403).json({ message: "无权限更新该问题" });
  }
  const updates = { ...req.body };
  if (updates.status && updates.status === "resolved") {
    updates.resolved_by = req.user.id;
    updates.resolved_at = new Date().toISOString();
  }
  const setClause = Object.keys(updates)
    .map((key) => `${key} = @${key}`)
    .join(", ");
  if (!setClause) {
    return res.status(400).json({ message: "没有需要更新的内容" });
  }
  db.prepare(`UPDATE audit_issues SET ${setClause} WHERE id = @id`).run({ ...updates, id: issueId });
  res.json({ issue: db.prepare("SELECT * FROM audit_issues WHERE id = ?").get(issueId) });
});

router.get("/:id", authenticate, (req, res) => {
  const { id } = req.params;
  if (!userHasTaskAccess(id, req.user.id)) {
    return res.status(404).json({ message: "任务不存在或无权限访问" });
  }
  const row = db
    .prepare(
      `SELECT t.*, 
        p.name as project_name,
        p.description as project_description,
        p.repository_url as project_repository_url,
        p.repository_type as project_repository_type,
        p.default_branch as project_default_branch,
        p.programming_languages as project_programming_languages,
        p.owner_id as project_owner_id,
        p.is_active as project_is_active,
        p.created_at as project_created_at,
        p.updated_at as project_updated_at,
        c.id as creator_id,
        c.email as creator_email,
        c.full_name as creator_full_name,
        c.role as creator_role
       FROM audit_tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN profiles c ON c.id = t.created_by
       WHERE t.id = ?`
    )
    .get(id);
  res.json({ task: mapTask(row) });
});

export default router;
