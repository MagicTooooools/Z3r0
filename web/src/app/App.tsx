import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useOutletContext } from "react-router-dom";
import { AuthProvider, useAuth } from "../shared/auth/AuthProvider";

const LandingPage = lazy(() => import("../features/landing/LandingPage").then((module) => ({ default: module.LandingPage })));
const LoginPage = lazy(() => import("../features/auth/LoginPage").then((module) => ({ default: module.LoginPage })));
const ProtectedAdminShell = lazy(() => import("./layouts/ProtectedAdminShell").then((module) => ({ default: module.ProtectedAdminShell })));
const PlaygroundPage = lazy(() => import("../features/playground/PlaygroundPage").then((module) => ({ default: module.PlaygroundPage })));
const SandboxContainersPage = lazy(() => import("../features/sandbox-containers/SandboxContainersPage").then((module) => ({ default: module.SandboxContainersPage })));
const SandboxImagesPage = lazy(() => import("../features/sandbox-images/SandboxImagesPage").then((module) => ({ default: module.SandboxImagesPage })));
const SystemUsersPage = lazy(() => import("../features/system-users/SystemUsersPage").then((module) => ({ default: module.SystemUsersPage })));
const WorkProjectsPage = lazy(() => import("../features/work-projects/WorkProjectsPage").then((module) => ({ default: module.WorkProjectsPage })));

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

function AdminOnlyRoute() {
  const { user } = useAuth();
  const outletContext = useOutletContext();
  if (user?.role !== "admin") {
    return <Navigate to="/playground" replace />;
  }
  return <Outlet context={outletContext} />;
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
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route element={<ProtectedAdminShell />}>
                <Route path="/playground" element={<PlaygroundPage />} />
                <Route element={<AdminOnlyRoute />}>
                  <Route path="/work-projects" element={<WorkProjectsPage />} />
                  <Route path="/sandbox-images" element={<SandboxImagesPage />} />
                  <Route path="/sandbox-containers" element={<SandboxContainersPage />} />
                  <Route path="/system-users" element={<SystemUsersPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/playground" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

function RouteFallback() {
  return (
    <div className="route-fallback">
      <div className="route-fallback-spinner" />
    </div>
  );
}
