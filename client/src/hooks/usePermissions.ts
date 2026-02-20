import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export type ModuleId = 
  | 'dashboard' 
  | 'gateway_config' 
  | 'instrument_config' 
  | 'cabinet_group' 
  | 'data_records' 
  | 'alarm_management' 
  | 'data_analysis' 
  | 'audit_logs' 
  | 'user_management' 
  | 'layout_editor';

export function usePermissions() {
  const { user } = useAuth();
  const { data: permissions, isLoading } = trpc.users.myPermissions.useQuery(
    undefined,
    { enabled: !!user }
  );

  const isAdmin = user?.role === 'admin';

  const canView = (moduleId: ModuleId): boolean => {
    if (isAdmin) return true;
    if (!permissions) return false;
    const perm = permissions.find((p: any) => p.module === moduleId);
    return perm ? perm.canView === 1 : false;
  };

  const canOperate = (moduleId: ModuleId): boolean => {
    if (isAdmin) return true;
    if (!permissions) return false;
    const perm = permissions.find((p: any) => p.module === moduleId);
    return perm ? perm.canOperate === 1 : false;
  };

  return {
    isAdmin,
    canView,
    canOperate,
    permissions,
    isLoading,
  };
}
