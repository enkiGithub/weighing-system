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
import Channels from "./pages/Channels";
import AuditLogs from "./pages/AuditLogs";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Monitor} />
        <Route path={"/gateways"} component={Gateways} />
        <Route path={"/devices"} component={Devices} />
        <Route path={"/channels"} component={Channels} />
        <Route path={"/cabinets"} component={Cabinets} />
        <Route path={"/records"} component={Records} />
        <Route path={"/alarms"} component={Alarms} />
        <Route path={"/analytics"} component={Analytics} />
        <Route path={"/users"} component={Users} />
        <Route path={"/audit-logs"} component={AuditLogs} />
        <Route path={"/layout-editor"} component={LayoutEditor} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
