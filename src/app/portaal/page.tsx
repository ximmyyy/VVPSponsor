import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { WorkspaceOverview } from "@/components/shell/workspace-overview";
export default function PortalPage() {
  return (
    <WorkspaceShell workspace="sponsor">
      <WorkspaceOverview workspace="sponsor" />
    </WorkspaceShell>
  );
}
