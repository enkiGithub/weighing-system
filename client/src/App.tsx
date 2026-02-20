import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
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
import Login from "./pages/Login";

function DashboardRouter() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Monitor} />
        <Route path={"/gateways"} component={Gateways} />
        <Route path={"/devices"} component={Devices} />
        <Route path={"/cabinets"} component={Cabinets} />
        <Route path={"/records"} component={Records} />
        <Route path={"/alarms"} component={Alarms} />
        <Route path={"/analytics"} component={Analytics} />
        <Route path={"/users"} component={Users} />
        <Route path={"/audit-logs"} component={AuditLogs} />
        <Route path={"/layout-editor"} component={LayoutEditor} />
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
