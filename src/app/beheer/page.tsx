import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { WorkspaceOverview } from "@/components/shell/workspace-overview";
export default function ManagementPage() {
  return (
    <WorkspaceShell workspace="commissie">
      <WorkspaceOverview workspace="commissie" />
    </WorkspaceShell>
  );
}
