import { useNavigate } from "react-router-dom";
import z3r0Logo from "../../assets/z3r0-logo.png";
import { useAuth } from "../../shared/auth/AuthProvider";
import { LandingContent } from "./LandingContent";

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const consolePath = isAuthenticated ? "/playground" : "/login";

  return <LandingContent logoSrc={z3r0Logo} primaryAction={{ label: "Open workbench", onSelect: () => navigate(consolePath) }} />;
}
