import { PublicShell } from "@/components/public-shell";
import { LoadingState } from "@/components/states";
export default function Loading() {
  return (
    <PublicShell>
      <div className="public-width state-page">
        <LoadingState />
      </div>
    </PublicShell>
  );
}
