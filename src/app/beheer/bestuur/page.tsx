import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { WorkspaceOverview } from "@/components/shell/workspace-overview";
export default function BoardPage() {
  return (
    <WorkspaceShell workspace="bestuur">
      <WorkspaceOverview workspace="bestuur" />
    </WorkspaceShell>
  );
}
