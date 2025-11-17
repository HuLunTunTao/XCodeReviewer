import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "..", "data");
const defaultDbPath = path.join(dataDir, "xcodereviewer.db");
const configuredPath = process.env.SQLITE_DB_PATH;
const dbPath = configuredPath ? path.resolve(configuredPath) : defaultDbPath;

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      github_username TEXT,
      gitlab_username TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      repository_url TEXT,
      repository_type TEXT DEFAULT 'github',
      default_branch TEXT DEFAULT 'main',
      programming_languages TEXT DEFAULT '[]',
      owner_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(owner_id) REFERENCES profiles(id)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      permissions TEXT DEFAULT '{}',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, user_id),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT,
      task_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      branch_name TEXT,
      exclude_patterns TEXT DEFAULT '[]',
      scan_config TEXT DEFAULT '{}',
      total_files INTEGER DEFAULT 0,
      scanned_files INTEGER DEFAULT 0,
      total_lines INTEGER DEFAULT 0,
      issues_count INTEGER DEFAULT 0,
      quality_score REAL DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by) REFERENCES profiles(id)
    );

    CREATE TABLE IF NOT EXISTS audit_issues (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      line_number INTEGER,
      column_number INTEGER,
      issue_type TEXT DEFAULT 'maintainability',
      severity TEXT DEFAULT 'low',
      title TEXT NOT NULL,
      description TEXT,
      suggestion TEXT,
      code_snippet TEXT,
      ai_explanation TEXT,
      status TEXT DEFAULT 'open',
      resolved_by TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(task_id) REFERENCES audit_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY(resolved_by) REFERENCES profiles(id)
    );

    CREATE TABLE IF NOT EXISTS instant_analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      language TEXT NOT NULL,
      code_content TEXT DEFAULT '',
      analysis_result TEXT DEFAULT '{}',
      issues_count INTEGER DEFAULT 0,
      quality_score REAL DEFAULT 0,
      analysis_time REAL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `);
}

export default db;
