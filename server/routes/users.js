import { Router } from "express";
import db from "../db.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = Router();
const baseFields = `
  id, email, full_name, phone, role, github_username, gitlab_username, avatar_url,
  created_at, updated_at
`;

router.get("/", authenticate, requireAdmin, (_req, res) => {
  const users = db.prepare(`SELECT ${baseFields} FROM profiles ORDER BY created_at DESC`).all();
  res.json({ users });
});

router.get("/options", authenticate, (req, res) => {
  const users = db
    .prepare(`SELECT id, email, full_name, role FROM profiles WHERE id != ? ORDER BY full_name`)
    .all(req.user.id);
  res.json({ users });
});

router.get("/:id", authenticate, (req, res) => {
  const { id } = req.params;
  if (req.user.id !== id && req.user.role !== "admin") {
    return res.status(403).json({ message: "无权限查看该用户" });
  }
  const user = db.prepare(`SELECT ${baseFields} FROM profiles WHERE id = ?`).get(id);
  if (!user) {
    return res.status(404).json({ message: "用户不存在" });
  }
  res.json({ user });
});

router.patch("/:id", authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!["admin", "member"].includes(role)) {
    return res.status(400).json({ message: "不支持的角色" });
  }
  db.prepare(
    `UPDATE profiles SET role = @role, updated_at = datetime('now') WHERE id = @id`
  ).run({ id, role });
  const user = db.prepare(`SELECT ${baseFields} FROM profiles WHERE id = ?`).get(id);
  res.json({ user });
});

export default router;
