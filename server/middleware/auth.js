import jwt from "jsonwebtoken";
import db from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "xcodereviewer-secret";

export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "未授权" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare("SELECT * FROM profiles WHERE id = ?").get(payload.userId);
    if (!user) {
      return res.status(401).json({ message: "用户不存在或已被删除" });
    }
    req.user = { id: user.id, role: user.role, email: user.email, full_name: user.full_name };
    next();
  } catch (error) {
    console.error("auth error", error);
    return res.status(401).json({ message: "身份验证失败" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "需要管理员权限" });
  }
  next();
}
