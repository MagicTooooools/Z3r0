import { ContainerShellProvider } from "../../features/container-shell/ContainerShellProvider";
import { AgentSessionProvider } from "../../features/playground/AgentSessionProvider";
import { AdminLayout } from "./AdminLayout";

export function ProtectedAdminShell() {
  return (
    <AgentSessionProvider>
      <ContainerShellProvider>
        <AdminLayout />
      </ContainerShellProvider>
    </AgentSessionProvider>
  );
}
