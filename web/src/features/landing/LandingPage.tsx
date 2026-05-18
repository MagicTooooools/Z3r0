import { useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/auth/AuthProvider";
import { LandingContent } from "./LandingContent";

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const consolePath = isAuthenticated ? "/playground" : "/login";

  return <LandingContent onOpenWorkbench={() => navigate(consolePath)} />;
}
