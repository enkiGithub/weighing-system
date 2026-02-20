import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2, Shield, UserCog, Settings2, Plus, Pencil, KeyRound, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type UserFormData = {
  username: string;
  password: string;
  name: string;
  role: "admin" | "operator";
};

export default function Users() {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();
  const { data: currentUser } = trpc.auth.me.useQuery();
  const { data: modules } = trpc.users.getModules.useQuery();

  // 权限配置对话框
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [permState, setPermState] = useState<Record<string, { canView: boolean; canOperate: boolean }>>({});

  // 新建/编辑用户对话框
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [formData, setFormData] = useState<UserFormData>({ username: "", password: "", name: "", role: "operator" });
  const [showPassword, setShowPassword] = useState(false);

  // 重置密码对话框
  const [resetPwdDialogOpen, setResetPwdDialogOpen] = useState(false);
  const [resetPwdUserId, setResetPwdUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const { data: userPermissions, isLoading: permLoading } = trpc.users.getPermissions.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId && permDialogOpen }
  );

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("用户创建成功");
      closeUserDialog();
    },
    onError: (error) => toast.error(`创建失败: ${error.message}`),
  });

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("用户信息更新成功");
      closeUserDialog();
    },
    onError: (error) => toast.error(`更新失败: ${error.message}`),
  });

  const resetPasswordMutation = trpc.users.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("密码重置成功");
      closeResetPwdDialog();
    },
    onError: (error) => toast.error(`重置失败: ${error.message}`),
  });

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("用户角色更新成功");
    },
    onError: (error) => toast.error(`更新失败: ${error.message}`),
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("用户删除成功");
    },
    onError: (error) => toast.error(`删除失败: ${error.message}`),
  });

  const setPermissionsMutation = trpc.users.setPermissions.useMutation({
    onSuccess: () => {
      utils.users.getPermissions.invalidate();
      toast.success("权限配置已保存");
      setPermDialogOpen(false);
    },
    onError: (error) => toast.error(`保存失败: ${error.message}`),
  });

  // ============ 用户对话框 ============
  const openCreateDialog = () => {
    setEditingUserId(null);
    setFormData({ username: "", password: "", name: "", role: "operator" });
    setShowPassword(false);
    setUserDialogOpen(true);
  };

  const openEditDialog = (user: { id: number; username: string; name: string | null; role: "admin" | "operator" }) => {
    setEditingUserId(user.id);
    setFormData({
      username: user.username,
      password: "",
      name: user.name || "",
      role: user.role,
    });
    setShowPassword(false);
    setUserDialogOpen(true);
  };

  const closeUserDialog = () => {
    setUserDialogOpen(false);
    setEditingUserId(null);
    setFormData({ username: "", password: "", name: "", role: "operator" });
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUserId) {
      // 编辑模式
      updateMutation.mutate({
        id: editingUserId,
        username: formData.username,
        name: formData.name || formData.username,
        role: formData.role,
      });
    } else {
      // 新建模式
      if (!formData.password || formData.password.length < 6) {
        toast.error("密码至少6位");
        return;
      }
      createMutation.mutate({
        username: formData.username,
        password: formData.password,
        name: formData.name || formData.username,
        role: formData.role,
      });
    }
  };

  // ============ 重置密码 ============
  const openResetPwdDialog = (userId: number) => {
    setResetPwdUserId(userId);
    setNewPassword("");
    setShowNewPassword(false);
    setResetPwdDialogOpen(true);
  };

  const closeResetPwdDialog = () => {
    setResetPwdDialogOpen(false);
    setResetPwdUserId(null);
    setNewPassword("");
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdUserId) return;
    if (newPassword.length < 6) {
      toast.error("新密码至少6位");
      return;
    }
    resetPasswordMutation.mutate({ id: resetPwdUserId, newPassword });
  };

  // ============ 角色和删除 ============
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

  // ============ 权限配置 ============
  const handleOpenPermissions = (userId: number) => {
    setSelectedUserId(userId);
    setPermDialogOpen(true);
  };

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
      if (field === 'canView' && !updated.canView) updated.canOperate = false;
      if (field === 'canOperate' && updated.canOperate) updated.canView = true;
      return { ...prev, [moduleId]: updated };
    });
  };

  const selectAllView = () => {
    if (!modules) return;
    setPermState(prev => {
      const next = { ...prev };
      for (const mod of modules) next[mod.id] = { ...next[mod.id], canView: true };
      return next;
    });
  };

  const selectAllOperate = () => {
    if (!modules) return;
    setPermState(prev => {
      const next = { ...prev };
      for (const mod of modules) next[mod.id] = { canView: true, canOperate: true };
      return next;
    });
  };

  const clearAll = () => {
    if (!modules) return;
    setPermState(prev => {
      const next = { ...prev };
      for (const mod of modules) next[mod.id] = { canView: false, canOperate: false };
      return next;
    });
  };

  // 权限对话框打开时自动初始化权限状态
  useEffect(() => {
    if (permDialogOpen && modules && userPermissions !== undefined && !permLoading) {
      const state: Record<string, { canView: boolean; canOperate: boolean }> = {};
      for (const mod of modules) {
        const existing = userPermissions?.find((p: any) => p.module === mod.id);
        state[mod.id] = {
          canView: existing ? existing.canView === 1 : false,
          canOperate: existing ? existing.canOperate === 1 : false,
        };
      }
      setPermState(state);
    }
  }, [permDialogOpen, modules, userPermissions, permLoading]);

  const selectedUser = users?.find(u => u.id === selectedUserId);
  const adminUsers = users?.filter(u => u.role === "admin") || [];
  const operatorUsers = users?.filter(u => u.role === "operator") || [];
  const resetPwdUser = users?.find(u => u.id === resetPwdUserId);

  // 渲染用户表格行
  const renderUserRow = (user: NonNullable<typeof users>[number], showPermissions: boolean) => {
    const isCurrentUser = user.id === currentUser?.id;
    return (
      <TableRow key={user.id}>
        <TableCell className="font-mono text-sm">{user.id}</TableCell>
        <TableCell className="font-medium">
          {user.username}
          {isCurrentUser && <Badge variant="outline" className="ml-2">当前</Badge>}
        </TableCell>
        <TableCell>{user.name || "-"}</TableCell>
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
                  <Shield className="h-4 w-4" />管理员
                </div>
              </SelectItem>
              <SelectItem value="operator">
                <div className="flex items-center gap-2">
                  <UserCog className="h-4 w-4" />操作员
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
        {showPermissions && (
          <TableCell className="text-center">
            <Button variant="ghost" size="sm" onClick={() => handleOpenPermissions(user.id)} title="配置权限">
              <Settings2 className="h-4 w-4 text-primary" />
            </Button>
          </TableCell>
        )}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)} title="编辑用户">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openResetPwdDialog(user.id)} title="重置密码">
              <KeyRound className="h-4 w-4 text-amber-500" />
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => handleDelete(user.id)}
              disabled={isCurrentUser || deleteMutation.isPending}
              title="删除用户"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">用户管理</h1>
          <p className="text-muted-foreground mt-2">管理系统用户、角色和权限</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          新建用户
        </Button>
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
            <div className="text-2xl font-bold text-primary">{adminUsers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">操作员</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{operatorUsers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* 管理员组 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />管理员组
          </CardTitle>
          <CardDescription>管理员拥有系统最高权限</CardDescription>
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
                  <TableHead>用户名</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminUsers.map((user) => renderUserRow(user, false))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 操作员组 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-amber-500" />操作员组
          </CardTitle>
          <CardDescription>操作员的权限由管理员分配</CardDescription>
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
                  <TableHead>用户名</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="text-center">权限</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operatorUsers.map((user) => renderUserRow(user, true))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新建/编辑用户对话框 */}
      <Dialog open={userDialogOpen} onOpenChange={(open) => { if (!open) closeUserDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUserId ? "编辑用户" : "新建用户"}</DialogTitle>
            <DialogDescription>
              {editingUserId ? "修改用户的基本信息" : "创建一个新的系统用户"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUserSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-username">用户名</Label>
              <Input
                id="form-username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="至少2位"
                required
                minLength={2}
                maxLength={64}
              />
            </div>
            {!editingUserId && (
              <div className="space-y-2">
                <Label htmlFor="form-password">密码</Label>
                <div className="relative">
                  <Input
                    id="form-password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="至少6位"
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="form-name">显示名称</Label>
              <Input
                id="form-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="可选，默认使用用户名"
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as "admin" | "operator" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4" />操作员
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />管理员
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeUserDialog}>取消</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {editingUserId ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog open={resetPwdDialogOpen} onOpenChange={(open) => { if (!open) closeResetPwdDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              为用户 <span className="font-semibold text-foreground">{resetPwdUser?.username || `#${resetPwdUserId}`}</span> 设置新密码
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少6位"
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeResetPwdDialog}>取消</Button>
              <Button type="submit" disabled={resetPasswordMutation.isPending}>
                {resetPasswordMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                确认重置
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 权限配置对话框 */}
      <Dialog open={permDialogOpen} onOpenChange={(open) => {
        setPermDialogOpen(open);
        if (!open) setSelectedUserId(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>权限配置 - {selectedUser?.name || `用户 #${selectedUserId}`}</DialogTitle>
            <DialogDescription>配置该操作员对各系统模块的查看和操作权限</DialogDescription>
          </DialogHeader>

          {permLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={initPermState}>重置</Button>
                <Button variant="outline" size="sm" onClick={selectAllView}>全选查看</Button>
                <Button variant="outline" size="sm" onClick={selectAllOperate}>全选操作</Button>
                <Button variant="outline" size="sm" onClick={clearAll}>清除全部</Button>
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
                            <Checkbox checked={perm.canView} onCheckedChange={() => togglePermission(mod.id, 'canView')} />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox checked={perm.canOperate} onCheckedChange={() => togglePermission(mod.id, 'canOperate')} />
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
            <Button variant="outline" onClick={() => setPermDialogOpen(false)}>取消</Button>
            <Button onClick={handleSavePermissions} disabled={setPermissionsMutation.isPending}>
              {setPermissionsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              保存权限
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
