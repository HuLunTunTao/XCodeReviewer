import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Database } from "lucide-react";

interface DatabaseManagerProps {
  tables: Array<{ name: string; rows: number }>;
  onRefresh: () => void;
  loading?: boolean;
}

export function DatabaseManager({ tables, onRefresh, loading }: DatabaseManagerProps) {
  const totalRows = tables.reduce((sum, table) => sum + table.rows, 0);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            数据库表概览
          </CardTitle>
          <CardDescription>查看 SQLite 本地数据库中的关键表及记录数量</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">总记录数</p>
            <p className="text-2xl font-bold">{totalRows}</p>
          </div>
          <div className="text-sm text-muted-foreground">
            当前模式：<span className="font-medium text-gray-900">服务器本地 SQLite</span>
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>表名</TableHead>
                <TableHead className="text-right">记录数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((table) => (
                <TableRow key={table.name}>
                  <TableCell className="font-medium">{table.name}</TableCell>
                  <TableCell className="text-right">{table.rows}</TableCell>
                </TableRow>
              ))}
              {tables.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                    暂无表数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
