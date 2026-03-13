import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { PermissionGuard } from "./components/PermissionGuard";
import Monitor from "./pages/Monitor";
import Gateways from "./pages/Gateways";
import Devices from "./pages/Devices";
import Cabinets from "./pages/Cabinets";
import Records from "./pages/Records";
import Alarms from "./pages/Alarms";
import Analytics from "./pages/Analytics";
import Users from "./pages/Users";
import LayoutEditor from "./pages/LayoutEditor";
import AuditLogs from "./pages/AuditLogs";
import SystemSettings from "./pages/SystemSettings";
import Login from "./pages/Login";

function DashboardRouter() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"}>
          <PermissionGuard moduleId="dashboard">
            <Monitor />
          </PermissionGuard>
        </Route>
        <Route path={"/gateways"}>
          <PermissionGuard moduleId="gateway_config">
            <Gateways />
          </PermissionGuard>
        </Route>
        <Route path={"/devices"}>
          <PermissionGuard moduleId="instrument_config">
            <Devices />
          </PermissionGuard>
        </Route>
        <Route path={"/cabinets"}>
          <PermissionGuard moduleId="cabinet_group">
            <Cabinets />
          </PermissionGuard>
        </Route>
        <Route path={"/records"}>
          <PermissionGuard moduleId="data_records">
            <Records />
          </PermissionGuard>
        </Route>
        <Route path={"/alarms"}>
          <PermissionGuard moduleId="alarm_management">
            <Alarms />
          </PermissionGuard>
        </Route>
        <Route path={"/analytics"}>
          <PermissionGuard moduleId="data_analysis">
            <Analytics />
          </PermissionGuard>
        </Route>
        <Route path={"/users"}>
          <PermissionGuard moduleId="user_management">
            <Users />
          </PermissionGuard>
        </Route>
        <Route path={"/audit-logs"}>
          <PermissionGuard moduleId="audit_logs">
            <AuditLogs />
          </PermissionGuard>
        </Route>
        <Route path={"/layout-editor"}>
          <PermissionGuard moduleId="layout_editor">
            <LayoutEditor />
          </PermissionGuard>
        </Route>
        <Route path={"/system-settings"}>
          <PermissionGuard moduleId="user_management">
            <SystemSettings />
          </PermissionGuard>
        </Route>
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
      >
        <TooltipProvider>
          <Toaster />
          <Switch>
            {/* 登录页面不使用DashboardLayout */}
            <Route path="/login" component={Login} />
            {/* 其他所有路由使用DashboardLayout */}
            <Route component={DashboardRouter} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
