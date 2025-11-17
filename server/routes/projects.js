import { Router } from "express";
import { randomUUID } from "node:crypto";
import db from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

const profileFields = `
  id, email, full_name, phone, role, github_username, gitlab_username, avatar_url,
  created_at, updated_at
`;

function getOwner(ownerId) {
  if (!ownerId) return null;
  return db.prepare(`SELECT ${profileFields} FROM profiles WHERE id = ?`).get(ownerId) || null;
}

function getProjectMembers(projectId) {
  return db
    .prepare(
      `SELECT pm.*, u.id as user_id, u.email, u.full_name, u.role as user_role
       FROM project_members pm
       JOIN profiles u ON u.id = pm.user_id
       WHERE pm.project_id = ?
       ORDER BY pm.created_at ASC`
    )
    .all(projectId)
    .map((row) => ({
      id: row.id,
      project_id: row.project_id,
      user_id: row.user_id,
      role: row.role,
      permissions: row.permissions || "{}",
      joined_at: row.joined_at,
      created_at: row.created_at,
      user: {
        id: row.user_id,
        email: row.email,
        full_name: row.full_name,
        role: row.user_role,
      },
    }));
}

function mapProject(row) {
  if (!row) return null;
  return {
    ...row,
    programming_languages: row.programming_languages || "[]",
    is_active: !!row.is_active,
    owner: getOwner(row.owner_id),
    members: getProjectMembers(row.id),
  };
}

function userHasAccess(projectId, userId) {
  const membership = db
    .prepare(`SELECT id FROM project_members WHERE project_id = ? AND user_id = ?`)
    .get(projectId, userId);
  return !!membership;
}

router.get("/", authenticate, (req, res) => {
  const rows = db
    .prepare(
      `SELECT DISTINCT p.*
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = ? AND p.is_active = 1
       ORDER BY p.created_at DESC`
    )
    .all(req.user.id);
  res.json({ projects: rows.map(mapProject) });
});

router.get("/deleted", authenticate, (req, res) => {
  const rows = db
    .prepare(
      `SELECT DISTINCT p.*
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = ? AND p.is_active = 0
       ORDER BY p.updated_at DESC`
    )
    .all(req.user.id);
  res.json({ projects: rows.map(mapProject) });
});

router.post("/", authenticate, (req, res) => {
  try {
    const {
      name,
      description,
      repository_url,
      repository_type = "github",
      default_branch = "main",
      programming_languages = [],
      members = [],
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "项目名称不能为空" });
    }

    const id = randomUUID();
    db.prepare(
      `INSERT INTO projects (
        id, name, description, repository_url, repository_type, default_branch,
        programming_languages, owner_id, is_active, created_at, updated_at
       ) VALUES (
        @id, @name, @description, @repository_url, @repository_type, @default_branch,
        @programming_languages, @owner_id, 1, datetime('now'), datetime('now')
       )`
    ).run({
      id,
      name,
      description: description || null,
      repository_url: repository_url || null,
      repository_type,
      default_branch,
      programming_languages: JSON.stringify(programming_languages || []),
      owner_id: req.user.id,
    });

    db.prepare(
      `INSERT INTO project_members (id, project_id, user_id, role, permissions)
       VALUES (@id, @project_id, @user_id, @role, '{}')`
    ).run({
      id: randomUUID(),
      project_id: id,
      user_id: req.user.id,
      role: "owner",
    });

    if (Array.isArray(members)) {
      const insertMember = db.prepare(
        `INSERT OR IGNORE INTO project_members (id, project_id, user_id, role, permissions)
         VALUES (@id, @project_id, @user_id, @role, '{}')`
      );
      members.forEach((member) => {
        if (!member || !member.user_id || member.user_id === req.user.id) return;
        const memberExists = db.prepare(`SELECT id FROM profiles WHERE id = ?`).get(member.user_id);
        if (!memberExists) return;
        insertMember.run({
          id: randomUUID(),
          project_id: id,
          user_id: member.user_id,
          role: member.role === "manager" ? "manager" : "operator",
        });
      });
    }

    res.status(201).json({ project: mapProject(db.prepare("SELECT * FROM projects WHERE id = ?").get(id)) });
  } catch (error) {
    console.error("create project error", error);
    res.status(500).json({ message: "创建项目失败" });
  }
});

router.get("/:id", authenticate, (req, res) => {
  const { id } = req.params;
  if (!userHasAccess(id, req.user.id)) {
    return res.status(404).json({ message: "项目不存在或无权限访问" });
  }
  const project = mapProject(db.prepare("SELECT * FROM projects WHERE id = ?").get(id));
  res.json({ project });
});

router.put("/:id", authenticate, (req, res) => {
  const { id } = req.params;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project || project.owner_id !== req.user.id) {
    return res.status(403).json({ message: "只有项目所有者可以编辑项目" });
  }

  const updates = {
    name: req.body.name ?? project.name,
    description: req.body.description ?? project.description,
    repository_url: req.body.repository_url ?? project.repository_url,
    repository_type: req.body.repository_type ?? project.repository_type,
    default_branch: req.body.default_branch ?? project.default_branch,
    programming_languages: JSON.stringify(
      req.body.programming_languages ?? JSON.parse(project.programming_languages || "[]")
    ),
  };

  db.prepare(
    `UPDATE projects SET
      name=@name,
      description=@description,
      repository_url=@repository_url,
      repository_type=@repository_type,
      default_branch=@default_branch,
      programming_languages=@programming_languages,
      updated_at=datetime('now')
     WHERE id=@id`
  ).run({ ...updates, id });

  res.json({ project: mapProject(db.prepare("SELECT * FROM projects WHERE id = ?").get(id)) });
});

router.delete("/:id", authenticate, (req, res) => {
  const { id } = req.params;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project || project.owner_id !== req.user.id) {
    return res.status(403).json({ message: "只有所有者可以删除项目" });
  }
  db.prepare(`UPDATE projects SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(id);
  res.json({ success: true });
});

router.post("/:id/restore", authenticate, (req, res) => {
  const { id } = req.params;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project || project.owner_id !== req.user.id) {
    return res.status(403).json({ message: "只有所有者可以恢复项目" });
  }
  db.prepare(`UPDATE projects SET is_active = 1, updated_at = datetime('now') WHERE id = ?`).run(id);
  res.json({ success: true });
});

router.delete("/:id/permanent", authenticate, (req, res) => {
  const { id } = req.params;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project || project.owner_id !== req.user.id) {
    return res.status(403).json({ message: "只有所有者可以永久删除项目" });
  }
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  res.json({ success: true });
});

router.get("/:id/members", authenticate, (req, res) => {
  const { id } = req.params;
  if (!userHasAccess(id, req.user.id)) {
    return res.status(404).json({ message: "项目不存在或无权限访问" });
  }
  res.json({ members: getProjectMembers(id) });
});

router.post("/:id/members", authenticate, (req, res) => {
  const { id } = req.params;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project || project.owner_id !== req.user.id) {
    return res.status(403).json({ message: "只有所有者可以管理成员" });
  }

  const { email, role = "operator" } = req.body;
  if (!email) {
    return res.status(400).json({ message: "请输入成员邮箱" });
  }
  const user = db.prepare(`SELECT id FROM profiles WHERE email = ?`).get(email.toLowerCase());
  if (!user) {
    return res.status(404).json({ message: "用户不存在" });
  }
  if (user.id === req.user.id) {
    return res.status(400).json({ message: "无需重复添加所有者" });
  }

  db.prepare(
    `INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, permissions, joined_at, created_at)
     VALUES (@id, @project_id, @user_id, @role, '{}', datetime('now'), datetime('now'))`
  ).run({
    id: randomUUID(),
    project_id: id,
    user_id: user.id,
    role: role === "manager" ? "manager" : "operator",
  });

  res.json({ members: getProjectMembers(id) });
});

router.delete("/:id/members/:memberId", authenticate, (req, res) => {
  const { id, memberId } = req.params;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project || project.owner_id !== req.user.id) {
    return res.status(403).json({ message: "只有所有者可以移除成员" });
  }

  const target = db.prepare("SELECT * FROM project_members WHERE id = ? AND project_id = ?").get(memberId, id);
  if (!target || target.user_id === req.user.id) {
    return res.status(400).json({ message: "无法移除此用户" });
  }

  db.prepare("DELETE FROM project_members WHERE id = ?").run(memberId);
  res.json({ members: getProjectMembers(id) });
});

export default router;
