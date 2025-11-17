import { Router } from "express";
import db from "../db.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/stats", authenticate, (_req, res) => {
  const totalProjects = db.prepare("SELECT COUNT(*) as c FROM projects").get().c || 0;
  const activeProjects = db
    .prepare("SELECT COUNT(*) as c FROM projects WHERE is_active = 1")
    .get().c || 0;
  const totalTasks = db.prepare("SELECT COUNT(*) as c FROM audit_tasks").get().c || 0;
  const completedTasks = db
    .prepare("SELECT COUNT(*) as c FROM audit_tasks WHERE status = 'completed'")
    .get().c || 0;
  const totalIssues = db.prepare("SELECT COUNT(*) as c FROM audit_issues").get().c || 0;
  const resolvedIssues = db
    .prepare("SELECT COUNT(*) as c FROM audit_issues WHERE status = 'resolved'")
    .get().c || 0;
  res.json({
    stats: {
      total_projects: totalProjects,
      active_projects: activeProjects,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      total_issues: totalIssues,
      resolved_issues: resolvedIssues,
    },
  });
});

router.get("/tables", authenticate, requireAdmin, (_req, res) => {
  const tables = [
    { name: "profiles", rows: db.prepare("SELECT COUNT(*) as c FROM profiles").get().c },
    { name: "projects", rows: db.prepare("SELECT COUNT(*) as c FROM projects").get().c },
    { name: "project_members", rows: db.prepare("SELECT COUNT(*) as c FROM project_members").get().c },
    { name: "audit_tasks", rows: db.prepare("SELECT COUNT(*) as c FROM audit_tasks").get().c },
    { name: "audit_issues", rows: db.prepare("SELECT COUNT(*) as c FROM audit_issues").get().c },
    { name: "instant_analyses", rows: db.prepare("SELECT COUNT(*) as c FROM instant_analyses").get().c },
  ];
  res.json({ tables });
});

export default router;
