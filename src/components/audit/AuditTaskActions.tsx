import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Trash2, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/shared/config/database";
import type { AuditTask } from "@/shared/types";
import { buildAuditTaskName } from "@/shared/utils/taskName";

interface AuditTaskActionsProps {
  task: AuditTask;
  onRenamed?: (task: AuditTask) => void;
  onDeleted?: (taskId: string) => void;
}

export function AuditTaskActions({ task, onRenamed, onDeleted }: AuditTaskActionsProps) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(task.name || buildAuditTaskName(task.project?.name));
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setRenameValue(task.name || buildAuditTaskName(task.project?.name));
  }, [task]);

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error("任务名称不能为空");
      return;
    }

    try {
      setRenaming(true);
      const updated = await api.updateAuditTask(task.id, { name: trimmed });
      toast.success("任务名称已更新");
      setRenameDialogOpen(false);
      onRenamed?.(updated);
    } catch (error) {
      console.error("重命名任务失败:", error);
      toast.error(error instanceof Error ? error.message : "重命名失败");
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.deleteAuditTask(task.id);
      toast.success("任务已删除");
      setDeleteDialogOpen(false);
      onDeleted?.(task.id);
    } catch (error) {
      console.error("删除任务失败:", error);
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="任务操作">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setRenameDialogOpen(true);
            }}
            className="flex items-center space-x-2"
          >
            <PencilLine className="w-4 h-4" />
            <span>重命名</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setDeleteDialogOpen(true);
            }}
            className="flex items-center space-x-2 text-red-600 focus:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
            <span>删除任务</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="audit-task-name">任务名称</Label>
            <Input
              id="audit-task-name"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="输入新的任务名称"
              disabled={renaming}
            />
            <p className="text-xs text-muted-foreground">
              建议包含项目、分支或时间信息，便于在列表中快速识别
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)} disabled={renaming}>
              取消
            </Button>
            <Button onClick={handleRename} disabled={renaming}>
              {renaming ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除该任务吗？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将无法恢复，并会连同该任务的所有审计结果一并清除。建议先导出报告或确认不再需要该任务。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
