import { Router } from "express";
import { randomUUID } from "node:crypto";
import db from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticate, (req, res) => {
  const analyses = db
    .prepare(
      `SELECT ia.*, p.id as user_id, p.email as user_email, p.full_name as user_full_name
       FROM instant_analyses ia
       JOIN profiles p ON p.id = ia.user_id
       WHERE ia.user_id = ?
       ORDER BY ia.created_at DESC`
    )
    .all(req.user.id)
    .map((row) => ({
      ...row,
      user: {
        id: row.user_id,
        email: row.user_email,
        full_name: row.user_full_name,
      },
    }));
  res.json({ analyses });
});

router.post("/", authenticate, (req, res) => {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO instant_analyses (
      id, user_id, language, code_content, analysis_result,
      issues_count, quality_score, analysis_time, created_at
    ) VALUES (
      @id, @user_id, @language, '', @analysis_result,
      @issues_count, @quality_score, @analysis_time, datetime('now')
    )`
  ).run({
    id,
    user_id: req.user.id,
    language: req.body.language,
    analysis_result: JSON.stringify(req.body.analysis_result || {}),
    issues_count: req.body.issues_count || 0,
    quality_score: req.body.quality_score || 0,
    analysis_time: req.body.analysis_time || 0,
  });
  const analysis = db.prepare("SELECT * FROM instant_analyses WHERE id = ?").get(id);
  res.status(201).json({ analysis });
});

export default router;
