import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { initDatabase } from "./db.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import taskRoutes from "./routes/tasks.js";
import instantRoutes from "./routes/instant.js";
import adminRoutes from "./routes/admin.js";
import userRoutes from "./routes/users.js";

const app = express();
const PORT = process.env.SERVER_PORT || 4000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, "..", "dist");

initDatabase();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/audit-tasks", taskRoutes);
app.use("/api/instant-analyses", instantRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(distPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use((err, _req, res, _next) => {
  console.error("Unhandled server error", err);
  res.status(500).json({ message: "服务器内部错误" });
});

app.listen(PORT, () => {
  console.log(`XCodeReviewer server listening on port ${PORT}`);
});
