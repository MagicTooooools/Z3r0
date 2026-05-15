import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AgentSessionProvider } from "../features/playground/AgentSessionProvider";
import { AuthProvider, useAuth } from "../shared/auth/AuthProvider";
import { AdminLayout } from "./layouts/AdminLayout";
import { LoginPage } from "../features/auth/LoginPage";
import { ContainerShellProvider } from "../features/container-shell/ContainerShellProvider";
import { LandingPage } from "../features/landing/LandingPage";
import { PlaygroundPage } from "../features/playground/PlaygroundPage";
import { SandboxContainersPage } from "../features/sandbox-containers/SandboxContainersPage";
import { SandboxImagesPage } from "../features/sandbox-images/SandboxImagesPage";
import { SystemUsersPage } from "../features/system-users/SystemUsersPage";
import { WorkProjectsPage } from "../features/work-projects/WorkProjectsPage";

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

function PublicOnlyRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/playground" replace />;
  }
  return <Outlet />;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AgentSessionProvider><ContainerShellProvider><AdminLayout /></ContainerShellProvider></AgentSessionProvider>}>
              <Route path="/playground" element={<PlaygroundPage />} />
              <Route path="/sandbox-images" element={<SandboxImagesPage />} />
              <Route path="/sandbox-containers" element={<SandboxContainersPage />} />
              <Route path="/system-users" element={<SystemUsersPage />} />
              <Route path="/work-projects" element={<WorkProjectsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/playground" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
