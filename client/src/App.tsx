import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { useAuth } from "./_core/hooks/useAuth";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import ScorecardUpload from "./pages/ScorecardUpload";
import ScorecardList from "./pages/ScorecardList";
import ScorecardDetail from "./pages/ScorecardDetail";
import Analyst from "./pages/Analyst";

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/" component={Home} />
      {isAuthenticated && (
        <>
          <Route path="/dashboard" component={() => <DashboardLayout><Dashboard /></DashboardLayout>} />
          <Route path="/scorecard/upload" component={() => <DashboardLayout><ScorecardUpload /></DashboardLayout>} />
          <Route path="/scorecard" component={() => <DashboardLayout><ScorecardList /></DashboardLayout>} />
          <Route path="/scorecard/:id" component={() => <DashboardLayout><ScorecardDetail /></DashboardLayout>} />
          <Route path="/analyst" component={() => <DashboardLayout><Analyst /></DashboardLayout>} />
        </>
      )}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
