import { usePermissions, type ModuleId } from "@/hooks/usePermissions";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Suspense, lazy, type ComponentType, type ReactNode } from "react";

interface PermissionGuardProps {
  moduleId: ModuleId;
  action?: "view" | "operate";
  children: ReactNode;
  /** 无权限时是否隐藏（默认显示无权限提示） */
  hide?: boolean;
}

/**
 * 权限保护组件
 * 包裹页面或功能区域，根据用户权限决定是否渲染内容
 * 无权限时不渲染 children，避免子组件发起无效 API 请求
 */
export function PermissionGuard({ moduleId, action = "view", children, hide }: PermissionGuardProps) {
  const { canView, canOperate, isAdmin, isLoading } = usePermissions();

  // 权限数据加载中时显示加载指示器
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 管理员始终放行
  if (isAdmin) return <>{children}</>;

  const hasPermission = action === "view" ? canView(moduleId) : canOperate(moduleId);

  if (!hasPermission) {
    if (hide) return null;
    return <NoPermission />;
  }

  return <>{children}</>;
}

/** 无权限提示页面 */
function NoPermission() {
  const [, setLocation] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <ShieldAlert className="h-16 w-16 text-muted-foreground/50" />
      <h2 className="text-xl font-semibold text-foreground">无访问权限</h2>
      <p className="text-muted-foreground text-center max-w-md">
        您没有访问此模块的权限。请联系管理员分配相应权限。
      </p>
      <Button variant="outline" onClick={() => setLocation("/")}>
        返回首页
      </Button>
    </div>
  );
}

/**
 * 操作权限保护组件
 * 用于包裹按钮等操作元素，无操作权限时隐藏
 */
export function OperateGuard({ moduleId, children }: { moduleId: ModuleId; children: ReactNode }) {
  return (
    <PermissionGuard moduleId={moduleId} action="operate" hide>
      {children}
    </PermissionGuard>
  );
}
