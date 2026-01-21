import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import GuardDashboard from "@/pages/guard/dashboard";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminMaterials from "@/pages/admin/materials";
import AdminSites from "@/pages/admin/sites";
import AdminGuards from "@/pages/admin/guards";
import AdminRecords from "@/pages/admin/records";
import { Skeleton } from "@/components/ui/skeleton";

function ProtectedRoute({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode; 
  requiredRole?: "admin" | "guard";
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-16 w-48 mx-auto" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Redirect to={user.role === "admin" ? "/admin" : "/guard"} />;
  }

  return <>{children}</>;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-16 w-48 mx-auto" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/">
        {user ? (
          <Redirect to={user.role === "admin" ? "/admin" : "/guard"} />
        ) : (
          <LoginPage />
        )}
      </Route>

      <Route path="/guard">
        <ProtectedRoute requiredRole="guard">
          <GuardDashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/admin">
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/materials">
        <ProtectedRoute requiredRole="admin">
          <AdminMaterials />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/sites">
        <ProtectedRoute requiredRole="admin">
          <AdminSites />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/guards">
        <ProtectedRoute requiredRole="admin">
          <AdminGuards />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/records">
        <ProtectedRoute requiredRole="admin">
          <AdminRecords />
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
