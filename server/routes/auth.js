import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import db from "../db.js";
import { authenticate, generateToken } from "../middleware/auth.js";

const router = Router();

const baseProfileFields = `
  id, email, full_name, phone, role, github_username, gitlab_username, avatar_url,
  created_at, updated_at
`;

router.post("/register", (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "邮箱和密码为必填项" });
    }

    const existing = db.prepare("SELECT id FROM profiles WHERE email = ?").get(email.toLowerCase());
    if (existing) {
      return res.status(400).json({ message: "该邮箱已注册" });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const isFirstUser = db.prepare("SELECT COUNT(1) as count FROM profiles").get().count === 0;
    const id = randomUUID();

    db.prepare(`
      INSERT INTO profiles (id, email, password_hash, full_name, role, created_at, updated_at)
      VALUES (@id, @email, @password_hash, @full_name, @role, datetime('now'), datetime('now'))
    `).run({
      id,
      email: email.toLowerCase(),
      password_hash,
      full_name: full_name || email.split("@")[0],
      role: isFirstUser ? "admin" : "member"
    });

    const user = db.prepare(`SELECT ${baseProfileFields} FROM profiles WHERE id = ?`).get(id);
    const token = generateToken(user);
    res.json({ user, token });
  } catch (error) {
    console.error("register error", error);
    res.status(500).json({ message: "注册失败" });
  }
});

router.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "请输入邮箱和密码" });
    }

    const user = db
      .prepare(`SELECT *, password_hash FROM profiles WHERE email = ?`)
      .get(email.toLowerCase());

    if (!user) {
      return res.status(400).json({ message: "用户不存在" });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ message: "密码错误" });
    }

    const token = generateToken(user);
    const sanitized = (({ password_hash, ...rest }) => rest)(user);
    res.json({ user: sanitized, token });
  } catch (error) {
    console.error("login error", error);
    res.status(500).json({ message: "登录失败" });
  }
});

router.get("/me", authenticate, (req, res) => {
  const user = db.prepare(`SELECT ${baseProfileFields} FROM profiles WHERE id = ?`).get(req.user.id);
  res.json({ user });
});

export default router;
