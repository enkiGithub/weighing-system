import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2, Shield, UserCog, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Users() {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();
  const { data: currentUser } = trpc.auth.me.useQuery();
  const { data: modules } = trpc.users.getModules.useQuery();

  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [permState, setPermState] = useState<Record<string, { canView: boolean; canOperate: boolean }>>({});

  const { data: userPermissions, isLoading: permLoading } = trpc.users.getPermissions.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId && permDialogOpen }
  );

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("用户角色更新成功");
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("用户删除成功");
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  const setPermissionsMutation = trpc.users.setPermissions.useMutation({
    onSuccess: () => {
      utils.users.getPermissions.invalidate();
      toast.success("权限配置已保存");
      setPermDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`保存失败: ${error.message}`);
    },
  });

  const handleRoleChange = (userId: number, newRole: "admin" | "operator") => {
    const label = newRole === "admin" ? "管理员" : "操作员";
    if (confirm(`确定要将此用户角色更改为${label}吗？`)) {
      updateRoleMutation.mutate({ id: userId, role: newRole });
    }
  };

  const handleDelete = (userId: number) => {
    if (confirm("确定要删除此用户吗？此操作不可恢复！")) {
      deleteMutation.mutate({ id: userId });
    }
  };

  const handleOpenPermissions = (userId: number) => {
    setSelectedUserId(userId);
    setPermDialogOpen(true);
    // 权限数据会通过 useQuery 自动加载
  };

  // 当权限数据加载完成时，初始化本地状态
  const initPermState = () => {
    if (!modules) return;
    const state: Record<string, { canView: boolean; canOperate: boolean }> = {};
    for (const mod of modules) {
      const existing = userPermissions?.find((p: any) => p.module === mod.id);
      state[mod.id] = {
        canView: existing ? existing.canView === 1 : false,
        canOperate: existing ? existing.canOperate === 1 : false,
      };
    }
    setPermState(state);
  };

  const handleSavePermissions = () => {
    if (!selectedUserId || !modules) return;
    const permissions = modules.map(mod => ({
      module: mod.id,
      canView: permState[mod.id]?.canView ? 1 : 0,
      canOperate: permState[mod.id]?.canOperate ? 1 : 0,
    }));
    setPermissionsMutation.mutate({ userId: selectedUserId, permissions });
  };

  const togglePermission = (moduleId: string, field: 'canView' | 'canOperate') => {
    setPermState(prev => {
      const current = prev[moduleId] || { canView: false, canOperate: false };
      const updated = { ...current, [field]: !current[field] };
      // 如果取消查看权限，同时取消操作权限
      if (field === 'canView' && !updated.canView) {
        updated.canOperate = false;
      }
      // 如果启用操作权限，同时启用查看权限
      if (field === 'canOperate' && updated.canOperate) {
        updated.canView = true;
      }
      return { ...prev, [moduleId]: updated };
    });
  };

  const selectAllView = () => {
    if (!modules) return;
    setPermState(prev => {
      const next = { ...prev };
      for (const mod of modules) {
        next[mod.id] = { ...next[mod.id], canView: true };
      }
      return next;
    });
  };

  const selectAllOperate = () => {
    if (!modules) return;
    setPermState(prev => {
      const next = { ...prev };
      for (const mod of modules) {
        next[mod.id] = { canView: true, canOperate: true };
      }
      return next;
    });
  };

  const clearAll = () => {
    if (!modules) return;
    setPermState(prev => {
      const next = { ...prev };
      for (const mod of modules) {
        next[mod.id] = { canView: false, canOperate: false };
      }
      return next;
    });
  };

  const selectedUser = users?.find(u => u.id === selectedUserId);
  const adminUsers = users?.filter(u => u.role === "admin") || [];
  const operatorUsers = users?.filter(u => u.role === "operator") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">用户管理</h1>
          <p className="text-muted-foreground mt-2">管理系统用户、角色和权限</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">总用户数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{users?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">管理员</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {adminUsers.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">操作员</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {operatorUsers.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 管理员组 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            管理员组
          </CardTitle>
          <CardDescription>管理员拥有系统最高权限，可分配所有模块的使用、查看和操作权限</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : adminUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">暂无管理员</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>登录方式</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminUsers.map((user) => {
                  const isCurrentUser = user.id === currentUser?.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm">{user.id}</TableCell>
                      <TableCell className="font-medium">
                        {user.name || "-"}
                        {isCurrentUser && (
                          <Badge variant="outline" className="ml-2">当前用户</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{user.email || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.loginMethod || "-"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user.id, value as "admin" | "operator")}
                          disabled={isCurrentUser || updateRoleMutation.isPending}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                管理员
                              </div>
                            </SelectItem>
                            <SelectItem value="operator">
                              <div className="flex items-center gap-2">
                                <UserCog className="h-4 w-4" />
                                操作员
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {format(new Date(user.createdAt), "yyyy-MM-dd")}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {format(new Date(user.lastSignedIn), "yyyy-MM-dd HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user.id)}
                          disabled={isCurrentUser || deleteMutation.isPending}
                          title="删除用户"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 操作员组 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-amber-500" />
            操作员组
          </CardTitle>
          <CardDescription>操作员的权限由管理员分配，可配置各模块的查看和操作权限</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : operatorUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">暂无操作员</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>登录方式</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="text-center">权限配置</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operatorUsers.map((user) => {
                  const isCurrentUser = user.id === currentUser?.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm">{user.id}</TableCell>
                      <TableCell className="font-medium">
                        {user.name || "-"}
                        {isCurrentUser && (
                          <Badge variant="outline" className="ml-2">当前用户</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{user.email || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.loginMethod || "-"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user.id, value as "admin" | "operator")}
                          disabled={isCurrentUser || updateRoleMutation.isPending}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                管理员
                              </div>
                            </SelectItem>
                            <SelectItem value="operator">
                              <div className="flex items-center gap-2">
                                <UserCog className="h-4 w-4" />
                                操作员
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {format(new Date(user.createdAt), "yyyy-MM-dd")}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {format(new Date(user.lastSignedIn), "yyyy-MM-dd HH:mm")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenPermissions(user.id)}
                          title="配置权限"
                        >
                          <Settings2 className="h-4 w-4 text-primary" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user.id)}
                          disabled={isCurrentUser || deleteMutation.isPending}
                          title="删除用户"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 权限配置对话框 */}
      <Dialog open={permDialogOpen} onOpenChange={(open) => {
        setPermDialogOpen(open);
        if (!open) setSelectedUserId(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>权限配置 - {selectedUser?.name || `用户 #${selectedUserId}`}</DialogTitle>
            <DialogDescription>
              配置该操作员对各系统模块的查看和操作权限
            </DialogDescription>
          </DialogHeader>

          {permLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { initPermState(); }}>
                  重置
                </Button>
                <Button variant="outline" size="sm" onClick={selectAllView}>
                  全选查看
                </Button>
                <Button variant="outline" size="sm" onClick={selectAllOperate}>
                  全选操作
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  清除全部
                </Button>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">系统模块</TableHead>
                      <TableHead className="text-center w-[120px]">查看权限</TableHead>
                      <TableHead className="text-center w-[120px]">操作权限</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules?.map((mod) => {
                      // 初始化时如果permState为空，从userPermissions加载
                      if (!permState[mod.id] && userPermissions) {
                        const existing = userPermissions.find((p: any) => p.module === mod.id);
                        permState[mod.id] = {
                          canView: existing ? existing.canView === 1 : false,
                          canOperate: existing ? existing.canOperate === 1 : false,
                        };
                      }
                      const perm = permState[mod.id] || { canView: false, canOperate: false };
                      return (
                        <TableRow key={mod.id}>
                          <TableCell className="font-medium">{mod.name}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.canView}
                              onCheckedChange={() => togglePermission(mod.id, 'canView')}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm.canOperate}
                              onCheckedChange={() => togglePermission(mod.id, 'canOperate')}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-muted-foreground">
                提示：启用"操作权限"会自动启用"查看权限"；取消"查看权限"会同时取消"操作权限"。
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSavePermissions}
              disabled={setPermissionsMutation.isPending}
            >
              {setPermissionsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              保存权限
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
